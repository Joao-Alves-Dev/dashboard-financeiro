'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DownloadIcon, FileTextIcon, Share2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FAVORECIDO_MAX, normalizarFavorecido } from '@/features/favorecido/normalizar'
import { cn } from '@/lib/utils'
import { buscarLancamentosParaExportar } from './actions'
import { baixarPdf, baixarPng, compartilharPng, type BaseArquivo } from './arquivos'
import { resolverPeriodo } from './periodos'
import { montarRelatorio, type TipoExportacao } from './relatorio'
import type { ResultadoExportacao } from './servico'
import { sugerirFavorecidos } from './sugerir-favorecidos'
import { usePrevia } from './use-previa'

type Props = {
  workspaceId: string
  /** Nomes já usados (grafia mais recente de cada um), do mais frequente ao menos. */
  favorecidos: { chave: string; nome: string }[]
  hoje: string
  inicial: {
    favorecido: string
    nome: string
    de: string
    ate: string
    tipo: TipoExportacao
    total: boolean
    anotacoes: 'descricao' | 'branco'
  }
}

type Busca = {
  chave: string
  de: string
  ate: string
  tipo: TipoExportacao
  favorecido: string
  resultado: { ok: true; data: ResultadoExportacao } | { ok: false; erro: string }
}

const TIPOS: TipoExportacao[] = ['saidas', 'entradas', 'todas']

/** Botão de escolha única (segmento): grande, com estado visível além da cor. */
function Segmento({
  ativo,
  aoClicar,
  children,
}: {
  ativo: boolean
  aoClicar: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={cn(
        'min-h-14 flex-1 rounded-xl border-2 px-3 text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        ativo ? 'border-marca bg-marca text-marca-foreground' : 'border-input bg-background hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

const ROTULO = 'text-lg font-semibold'

export function PaginaExportar({ workspaceId, favorecidos, hoje, inicial }: Props) {
  const t = useTranslations('exportacao')
  const listaId = useId()
  const [favorecido, setFavorecido] = useState(inicial.favorecido)
  const [nomeTitulo, setNomeTitulo] = useState(inicial.nome)
  const [de, setDe] = useState(inicial.de)
  const [ate, setAte] = useState(inicial.ate)
  const [tipo, setTipo] = useState<TipoExportacao>(inicial.tipo)
  const [mostrarTotal, setMostrarTotal] = useState(inicial.total)
  const [anotacoes, setAnotacoes] = useState(inicial.anotacoes)
  const [busca, setBusca] = useState<Busca | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const favorecidoTxt = favorecido.trim()
  const periodoValido = de !== '' && ate !== '' && de <= ate
  const chaveBusca = `${favorecidoTxt}|${de}|${ate}|${tipo}`

  // Busca no servidor (com pequena espera enquanto se digita). Só leitura.
  useEffect(() => {
    if (!periodoValido) return
    let cancelado = false
    const timer = setTimeout(async () => {
      const r = await buscarLancamentosParaExportar(workspaceId, { favorecido: favorecidoTxt, de, ate, tipo })
      if (!cancelado) {
        setBusca({ chave: chaveBusca, de, ate, tipo, favorecido: favorecidoTxt, resultado: r.ok ? r : { ok: false, erro: r.erro } })
      }
    }, 300)
    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [workspaceId, favorecidoTxt, de, ate, tipo, periodoValido, chaveBusca])

  // Parâmetros na URL: a tela pode ser aberta já preenchida (voz, lista de lançamentos) e recarregada.
  useEffect(() => {
    const p = new URLSearchParams()
    if (favorecidoTxt) p.set('favorecido', favorecidoTxt)
    if (nomeTitulo.trim()) p.set('nome', nomeTitulo.trim())
    if (de) p.set('de', de)
    if (ate) p.set('ate', ate)
    if (tipo !== 'saidas') p.set('tipo', tipo)
    if (mostrarTotal) p.set('total', '1')
    if (anotacoes === 'branco') p.set('anotacoes', 'branco')
    const qs = p.toString()
    window.history.replaceState(window.history.state, '', qs ? `?${qs}` : window.location.pathname)
  }, [favorecidoTxt, nomeTitulo, de, ate, tipo, mostrarTotal, anotacoes])

  const atual = busca?.chave === chaveBusca
  const dados = busca?.resultado.ok ? busca.resultado.data : null
  const nomePadrao = dados?.nome ?? busca?.favorecido ?? favorecidoTxt
  const nomeEfetivo = nomeTitulo.trim() || nomePadrao

  const relatorio = useMemo(
    () =>
      busca && dados
        ? montarRelatorio(dados.itens, {
            favorecido: nomeEfetivo,
            de: busca.de,
            ate: busca.ate,
            tipo: busca.tipo,
            mostrarTotal,
            anotacoes,
          })
        : null,
    [busca, dados, nomeEfetivo, mostrarTotal, anotacoes],
  )
  const previa = usePrevia(relatorio)

  const carregando = periodoValido && !atual
  const vazio = atual && relatorio !== null && relatorio.linhas.length === 0
  const naoExiste = atual && dados !== null && favorecidoTxt !== '' && normalizarFavorecido(favorecidoTxt) !== '' && !dados.existe
  const sugestoes = naoExiste ? sugerirFavorecidos(favorecidoTxt, favorecidos) : []
  const pronto = atual && relatorio !== null && relatorio.linhas.length > 0 && !previa.gerando && previa.blobs.length > 0
  const base: BaseArquivo = { nome: nomeEfetivo || 'todos', de: busca?.de ?? de, ate: busca?.ate ?? ate }

  function atalho(texto: string) {
    const p = resolverPeriodo(texto, hoje)
    if (p) {
      setDe(p.de)
      setAte(p.ate)
    }
  }

  async function executar(acao: () => Promise<string | null>) {
    setAviso(null)
    setOcupado(true)
    try {
      const msg = await acao()
      if (msg) setAviso({ texto: msg, erro: false })
    } catch {
      setAviso({ texto: t('erroGerar'), erro: true })
    } finally {
      setOcupado(false)
    }
  }

  const compartilhar = () =>
    executar(async () => {
      const r = await compartilharPng(previa.blobs, base, t('tituloCompartilhar', { nome: nomeEfetivo || t('todos') }))
      return r === 'compartilhado' ? t('compartilhadoOk') : r === 'baixado' ? t('baixadoOk') : null
    })
  const baixarImagens = () =>
    executar(async () => {
      baixarPng(previa.blobs, base)
      return t('baixadoOk')
    })
  const baixarDocumento = () =>
    executar(async () => {
      if (!relatorio) return null
      await baixarPdf(relatorio, base)
      return t('baixadoOk')
    })

  const nomesLista = useMemo(() => favorecidos.map((f) => f.nome), [favorecidos])
  const botaoAcao = 'h-14 w-full gap-2 text-lg font-semibold'

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <p className="max-w-prose text-base text-muted-foreground">{t('descricao')}</p>
      </header>

      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-favorecido" className={ROTULO}>
            {t('favorecido')}
          </Label>
          <div className="flex gap-2">
            <Input
              id="exp-favorecido"
              list={listaId}
              autoComplete="off"
              maxLength={FAVORECIDO_MAX + 40}
              placeholder={t('favorecidoPlaceholder')}
              value={favorecido}
              onChange={(e) => setFavorecido(e.target.value)}
              className="h-14 flex-1 text-xl md:text-xl"
            />
            <Button type="button" variant="outline" className="h-14 px-5 text-lg" onClick={() => setFavorecido('')}>
              {t('todos')}
            </Button>
          </div>
          <datalist id={listaId}>
            {nomesLista.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <p className="text-sm text-muted-foreground">{t('favorecidoDica')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="exp-nome" className={ROTULO}>
            {t('nomeTitulo')}
          </Label>
          <Input
            id="exp-nome"
            autoComplete="off"
            maxLength={FAVORECIDO_MAX}
            placeholder={nomePadrao || t('todos')}
            value={nomeTitulo}
            onChange={(e) => setNomeTitulo(e.target.value)}
            className="h-14 text-xl md:text-xl"
          />
          <p className="text-sm text-muted-foreground">{t('nomeTituloDica', { padrao: nomePadrao || t('todos') })}</p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={ROTULO}>{t('periodo')}</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['esteMes', 'este mês'],
                ['mesPassado', 'mês passado'],
                ['ultimos30', 'últimos 30 dias'],
              ] as const
            ).map(([chave, fala]) => (
              <Button key={chave} type="button" variant="outline" className="h-12 px-4 text-base" onClick={() => atalho(fala)}>
                {t(`atalhos.${chave}`)}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-de">{t('de')}</Label>
              <Input id="exp-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-14 text-lg md:text-lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp-ate">{t('ate')}</Label>
              <Input id="exp-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-14 text-lg md:text-lg" />
            </div>
          </div>
          {!periodoValido && de !== '' && ate !== '' && (
            <p role="alert" className="text-base font-medium text-destructive">
              {t('periodoInvertido')}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={ROTULO}>{t('tipo.titulo')}</legend>
          <div className="flex gap-2">
            {TIPOS.map((x) => (
              <Segmento key={x} ativo={tipo === x} aoClicar={() => setTipo(x)}>
                {t(`tipo.${x}`)}
              </Segmento>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={ROTULO}>{t('anotacoes.titulo')}</legend>
          <div className="flex gap-2">
            <Segmento ativo={anotacoes === 'descricao'} aoClicar={() => setAnotacoes('descricao')}>
              {t('anotacoes.descricao')}
            </Segmento>
            <Segmento ativo={anotacoes === 'branco'} aoClicar={() => setAnotacoes('branco')}>
              {t('anotacoes.branco')}
            </Segmento>
          </div>
        </fieldset>

        <div className="flex items-center gap-3 rounded-xl border p-4">
          <Checkbox id="exp-total" checked={mostrarTotal} onCheckedChange={(v) => setMostrarTotal(v === true)} className="size-7 rounded-md" />
          <Label htmlFor="exp-total" className="min-h-8 flex-1 text-lg font-medium">
            {t('mostrarTotal')}
          </Label>
        </div>
        <p className="-mt-3 text-sm text-muted-foreground">{t('apenasEfetivadas')}</p>
      </form>

      <section aria-label={t('previa')} className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{t('previa')}</h2>

        {busca?.resultado.ok === false && atual && (
          <p role="alert" className="text-lg font-medium text-destructive">
            {busca.resultado.erro}
          </p>
        )}
        {carregando && (
          <p role="status" className="text-lg text-muted-foreground">
            {t('buscando')}
          </p>
        )}
        {naoExiste && (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <p role="status" className="text-lg font-medium">
              {t('naoExiste', { nome: favorecidoTxt })}
            </p>
            {sugestoes.length > 0 && (
              <>
                <p className="text-base text-muted-foreground">{t('querDizer')}</p>
                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <Button key={s.chave} type="button" variant="outline" className="h-12 px-4 text-lg" onClick={() => setFavorecido(s.nome)}>
                      {s.nome}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {vazio && !naoExiste && (
          <p role="status" className="rounded-xl border border-dashed p-6 text-lg font-medium">
            {nomeEfetivo ? t('vazio', { nome: nomeEfetivo }) : t('vazioTodos')}
          </p>
        )}
        {relatorio && relatorio.linhas.length > 0 && (
          <div className={cn('flex flex-col gap-3', (carregando || previa.gerando) && 'opacity-60')}>
            {previa.gerando && !carregando && (
              <p role="status" className="text-base text-muted-foreground">
                {t('gerando')}
              </p>
            )}
            {previa.erro && (
              <p role="alert" className="text-lg font-medium text-destructive">
                {t('erroGerar')}
              </p>
            )}
            {previa.urls.map((url, i) => (
              // A prévia é o próprio PNG que será enviado (blob local): nada de next/image aqui.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={t('previaAlt', { numero: i + 1, total: previa.urls.length })}
                className="w-full rounded-lg border bg-white"
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={!pronto || ocupado}
            onClick={compartilhar}
            className={cn(botaoAcao, 'h-16 bg-marca text-xl text-marca-foreground hover:bg-marca/90')}
          >
            <Share2Icon aria-hidden className="size-6" />
            {t('compartilhar')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={!pronto || ocupado} onClick={baixarImagens} className={botaoAcao}>
              <DownloadIcon aria-hidden className="size-5" />
              {t('baixarPng')}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!atual || !relatorio || relatorio.linhas.length === 0 || ocupado}
              onClick={baixarDocumento}
              className={botaoAcao}
            >
              <FileTextIcon aria-hidden className="size-5" />
              {t('baixarPdf')}
            </Button>
          </div>
          <p role="status" aria-live="polite" className={cn('min-h-6 text-base font-medium', aviso?.erro && 'text-destructive')}>
            {aviso?.texto}
          </p>
        </div>
      </section>
    </section>
  )
}
