'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MicIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CampoFavorecido } from '@/features/favorecido/campo-favorecido'
import { hojeLocal } from '@/lib/formato'
import { formatarBRL, parseValorBR } from '@/lib/money'
import { criarLancamento } from './actions'
import type { OpcaoCategoria, OpcaoConta } from './form-lancamento'

export type ValoresIniciaisRapido = {
  /** Texto editável no formato BR ('12,50'); o sinal vem de `tipoInicial`. */
  valorInicial?: string
  tipoInicial?: 'entrada' | 'saida'
  descricaoInicial?: string
  /** 'YYYY-MM-DD'. */
  dataInicial?: string
  categoriaIdInicial?: string | null
  contaIdInicial?: string | null
  /** Nome do favorecido (voz); se vier preenchido, o campo já abre expandido. */
  favorecidoInicial?: string
}

export type PropsLancamentoRapido = ValoresIniciaisRapido & {
  workspaceId: string
  contas: OpcaoConta[]
  /** Todas as categorias do workspace (a natureza decide a lista conforme saída/entrada). */
  categorias: OpcaoCategoria[]
  /** Categorias de despesa mais usadas (chips da saída). */
  frequentes: OpcaoCategoria[]
  /** Nomes de favorecidos já usados (autocomplete). */
  favorecidos: string[]
  /** Conta padrão já validada no servidor (cookie da última conta usada, senão a primeira). */
  contaPadraoId: string | null
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  /** Chamado após salvar, com o texto da confirmação (o provedor o exibe numa região `role=status`). */
  aoSalvar?: (mensagem: string) => void
  /** Atalho de voz do sheet: o provedor fecha o sheet e inicia o fluxo de voz. */
  aoFalar?: () => void
}

const LIMITE_CHIPS = 6

export function LancamentoRapido(props: PropsLancamentoRapido) {
  const t = useTranslations('rapido')
  return (
    <Sheet open={props.aberto} onOpenChange={props.aoMudar}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-0 rounded-t-3xl p-0 pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2"
      >
        <SheetHeader className="px-5 pt-5 pb-2">
          <div className="flex items-center justify-between gap-3 pr-10">
            <SheetTitle className="text-lg">{t('titulo')}</SheetTitle>
            {props.aoFalar && props.contas.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 px-4 text-base"
                onClick={() => {
                  props.aoMudar(false)
                  props.aoFalar?.()
                }}
              >
                <MicIcon aria-hidden className="size-5" />
                {t('falar')}
              </Button>
            )}
          </div>
          <SheetDescription className="sr-only">{t('descricao')}</SheetDescription>
        </SheetHeader>
        {/* O Popup desmonta ao fechar, então o formulário reinicia (e relê os valores iniciais) a cada abertura. */}
        {props.contas.length === 0 ? (
          <SemConta workspaceId={props.workspaceId} aoMudar={props.aoMudar} />
        ) : (
          <Corpo {...props} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function SemConta({ workspaceId, aoMudar }: { workspaceId: string; aoMudar: (a: boolean) => void }) {
  const t = useTranslations('rapido')
  return (
    <div className="flex flex-col gap-3 px-5 pb-6">
      <p className="font-medium">{t('semContaTitulo')}</p>
      <p className="text-sm text-muted-foreground">{t('semContaTexto')}</p>
      <Link
        href={`/w/${workspaceId}/config`}
        onClick={() => aoMudar(false)}
        className={cn(buttonVariants(), 'h-12 text-base')}
      >
        {t('semContaLink')}
      </Link>
    </div>
  )
}

function Corpo({
  workspaceId,
  contas,
  categorias,
  frequentes,
  favorecidos,
  contaPadraoId,
  valorInicial,
  tipoInicial,
  descricaoInicial,
  dataInicial,
  categoriaIdInicial,
  contaIdInicial,
  favorecidoInicial,
  aoMudar,
  aoSalvar,
}: PropsLancamentoRapido) {
  const t = useTranslations('rapido')
  const tl = useTranslations('lancamentos')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>(tipoInicial ?? 'saida')
  const [valor, setValor] = useState(valorInicial ?? '')
  const [descricao, setDescricao] = useState(descricaoInicial ?? '')
  const [data, setData] = useState(dataInicial ?? hojeLocal())
  const [contaId, setContaId] = useState(
    contaIdInicial && contas.some((c) => c.id === contaIdInicial) ? contaIdInicial : (contaPadraoId ?? contas[0].id),
  )
  const [categoriaId, setCategoriaId] = useState<string | null>(categoriaIdInicial ?? null)
  const [todas, setTodas] = useState(false)
  // Campo opcional, recolhido por padrão para manter o fluxo de 2 toques; um link o expande.
  const [favorecido, setFavorecido] = useState(favorecidoInicial ?? '')
  const [favorecidoAberto, setFavorecidoAberto] = useState(Boolean(favorecidoInicial?.trim()))
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  const natureza = tipo === 'saida' ? 'despesa' : 'receita'
  const daNatureza = useMemo(() => categorias.filter((c) => c.natureza === natureza), [categorias, natureza])
  const chips = useMemo(() => {
    // Saída: as mais usadas e, se houver menos de 6 (usuário novo), completa com as demais por nome.
    const base =
      tipo === 'saida'
        ? [...frequentes, ...daNatureza.filter((c) => !frequentes.some((f) => f.id === c.id))].slice(
            0,
            Math.max(frequentes.length, LIMITE_CHIPS),
          )
        : daNatureza.slice(0, LIMITE_CHIPS)
    // Categoria vinda dos valores iniciais (voz) sempre aparece, mesmo fora das frequentes.
    const sel = categoriaId ? categorias.find((c) => c.id === categoriaId && c.natureza === natureza) : undefined
    return sel && !base.some((c) => c.id === sel.id) ? [sel, ...base] : base
  }, [tipo, frequentes, daNatureza, categoriaId, categorias, natureza])
  const temMais = daNatureza.length > chips.length
  const itensConta = contas.map((c) => ({ value: c.id, label: c.nome }))
  const lista = todas ? daNatureza : chips

  function trocarTipo(novo: 'entrada' | 'saida') {
    setTipo(novo)
    // A categoria só vale na natureza correspondente.
    const nat = novo === 'saida' ? 'despesa' : 'receita'
    if (categoriaId && categorias.find((c) => c.id === categoriaId)?.natureza !== nat) setCategoriaId(null)
    setTodas(false)
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCampos({})
    const nomeCategoria = categorias.find((c) => c.id === categoriaId)?.nome
    const entrada = {
      valor,
      tipo,
      data,
      // A descrição é opcional na tela; o servidor a exige, então cai na categoria (ou num texto padrão).
      descricao: descricao.trim() || nomeCategoria || t('descricaoPadrao'),
      contaId,
      categoriaId: categoriaId ?? '',
      status: 'efetivado' as const,
      favorecido,
    }
    iniciar(async () => {
      const r = await criarLancamento(workspaceId, entrada)
      if (r.ok) {
        const centavos = parseValorBR(valor) ?? 0
        aoSalvar?.(t('salvo', { valor: formatarBRL(Math.abs(centavos)), tipo: tl(`tipo.${tipo}`).toLowerCase() }))
        aoMudar(false)
      } else {
        setErro(r.erro)
        setCampos(r.campos ?? {})
      }
    })
  }

  return (
    <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        <div role="group" aria-label={tl('campos.tipo')} className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['saida', 'entrada'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={tipo === v}
              onClick={() => trocarTipo(v)}
              className={cn(
                'min-h-11 rounded-lg px-3 text-base font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                tipo === v
                  ? v === 'entrada'
                    ? 'bg-green-700 text-white'
                    : 'bg-red-600 text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tl(`tipo.${v}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="rapido-valor" className="sr-only">
            {t('valor')}
          </Label>
          <div className="flex items-baseline gap-2 border-b-2 border-input pb-1 focus-within:border-marca">
            <span aria-hidden className="text-2xl font-medium text-muted-foreground">
              R$
            </span>
            <input
              id="rapido-valor"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              aria-invalid={!!campos.valor}
              className="h-14 w-full min-w-0 bg-transparent text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          {campos.valor && <p className="text-sm text-destructive">{campos.valor}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t('categoria')}</legend>
          <div className={cn('flex flex-wrap gap-2', todas && 'max-h-44 overflow-y-auto')}>
            {lista.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoriaId === c.id}
                onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  categoriaId === c.id
                    ? 'border-marca bg-marca text-marca-foreground'
                    : 'border-input bg-background hover:bg-muted',
                )}
              >
                {c.nome}
              </button>
            ))}
            {lista.length === 0 && <p className="text-sm text-muted-foreground">{t('semCategorias')}</p>}
            {(temMais || todas) && (
              <button
                type="button"
                aria-expanded={todas}
                onClick={() => setTodas(!todas)}
                className="min-h-11 rounded-full border border-dashed border-input px-4 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {todas ? t('menos') : t('mais')}
              </button>
            )}
          </div>
          {campos.categoriaId && <p className="text-sm text-destructive">{campos.categoriaId}</p>}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rapido-descricao">{t('descricao_campo')}</Label>
          <Input
            id="rapido-descricao"
            autoComplete="off"
            className="h-11 text-base"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-invalid={!!campos.descricao}
          />
          {campos.descricao && <p className="text-sm text-destructive">{campos.descricao}</p>}
        </div>

        {favorecidoAberto ? (
          <CampoFavorecido
            id="rapido-favorecido"
            tipo={tipo}
            valor={favorecido}
            aoMudar={setFavorecido}
            sugestoes={favorecidos}
            erro={campos.favorecido}
            autoFocus={!favorecidoInicial}
            className="h-11 text-base"
          />
        ) : (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setFavorecidoAberto(true)}
            className="-mt-2 min-h-11 self-start rounded-md px-1 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {tipo === 'saida' ? t('favorecidoLinkSaida') : t('favorecidoLinkEntrada')}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('conta')}</Label>
            <Select value={contaId} items={itensConta} onValueChange={(v) => setContaId(v ?? contaId)}>
              <SelectTrigger className="h-11 w-full text-base" aria-label={t('conta')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itensConta.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campos.contaId && <p className="text-sm text-destructive">{campos.contaId}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rapido-data">{t('data')}</Label>
            <Input
              id="rapido-data"
              type="date"
              className="h-11 text-base"
              value={data}
              onChange={(e) => setData(e.target.value)}
              aria-invalid={!!campos.data}
            />
            {campos.data && <p className="text-sm text-destructive">{campos.data}</p>}
          </div>
        </div>

        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
      </div>

      <div className="border-t bg-popover px-5 py-3">
        <Button
          type="submit"
          disabled={pendente}
          className="h-14 w-full bg-marca text-lg text-marca-foreground hover:bg-marca/90"
        >
          {pendente ? t('salvando') : t('salvar')}
        </Button>
      </div>
    </form>
  )
}
