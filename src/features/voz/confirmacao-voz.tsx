'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { aplicarRegras, type Regra } from '@/features/importacao/aplicar-regras'
import { criarLancamento } from '@/features/lancamentos/actions'
import { useLancamentoRapido } from '@/features/lancamentos/lancamento-rapido-contexto'
import { centavosParaCampo, hojeLocal } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { dataPorExtenso } from './datas-fala'
import { falar } from './falar'
import type { FalaInterpretada } from './interpretar-fala'
import { CabecalhoVoz } from './telas-voz'
import { valorPorExtenso } from './valor-por-extenso'

type FalaOk = Extract<FalaInterpretada, { ok: true }>

const LINHA = 'flex flex-col gap-1 border-b py-3'
const ROTULO = 'text-base font-medium text-muted-foreground'
const VALOR_LINHA = 'text-2xl leading-snug font-semibold break-words'

export function ConfirmacaoVoz({
  fala,
  texto,
  regras,
  aoFalarDeNovo,
  aoFechar,
}: {
  fala: FalaOk
  texto: string
  regras: Regra[]
  aoFalarDeNovo: () => void
  aoFechar: () => void
}) {
  const t = useTranslations('voz')
  const tl = useTranslations('lancamentos')
  const tr = useTranslations('rapido')
  const { dados, abrir, avisar } = useLancamentoRapido()
  const entrada = fala.valorCentavos > 0
  const tipo = entrada ? 'entrada' : 'saida'
  const absoluto = Math.abs(fala.valorCentavos)

  const [favorecido, setFavorecido] = useState(fala.favorecido ?? '')
  const [contaId, setContaId] = useState(dados.contaPadraoId ?? dados.contas[0]?.id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Categoria sugerida pelas regras do workspace sobre a descrição; só vale se for da natureza certa.
  const categoria = useMemo(() => {
    const id = aplicarRegras([{ descricao: fala.descricao }], regras)[0].categoriaId
    const c = dados.categorias.find((x) => x.id === id)
    return c && c.natureza === (entrada ? 'receita' : 'despesa') ? c : null
  }, [fala.descricao, regras, dados.categorias, entrada])

  const itensConta = dados.contas.map((c) => ({ value: c.id, label: c.nome }))
  const semConta = dados.contas.length === 0
  const corValor = entrada ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'

  function salvar() {
    setErro(null)
    iniciar(async () => {
      const r = await criarLancamento(dados.workspaceId, {
        valor: centavosParaCampo(absoluto),
        tipo,
        data: fala.data,
        descricao: fala.descricao,
        contaId,
        categoriaId: categoria?.id ?? '',
        status: 'efetivado',
        favorecido,
      })
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      avisar(tr('salvo', { valor: formatarBRL(absoluto), tipo: tl(`tipo.${tipo}`).toLowerCase() }))
      falar(t('anotado', { valor: valorPorExtenso(absoluto), descricao: fala.descricao }))
      aoFechar()
    })
  }

  function corrigir() {
    aoFechar()
    abrir({
      valorInicial: centavosParaCampo(absoluto),
      tipoInicial: tipo,
      descricaoInicial: fala.descricao,
      dataInicial: fala.data,
      categoriaIdInicial: categoria?.id ?? null,
      contaIdInicial: contaId || null,
      favorecidoInicial: favorecido,
    })
  }

  return (
    <>
      <CabecalhoVoz descricao={t('confirme')} />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pb-4">
        <p className="pt-3 text-xl font-semibold">{t('confirme')}</p>

        <div className="flex flex-col gap-1 border-b py-4">
          <p className={cn('flex items-center gap-2 text-xl font-bold', corValor)}>
            {entrada ? (
              <ArrowUpRightIcon aria-hidden className="size-6" strokeWidth={3} />
            ) : (
              <ArrowDownRightIcon aria-hidden className="size-6" strokeWidth={3} />
            )}
            {tl(`tipo.${tipo}`)}
          </p>
          <p
            aria-label={`${tl(`tipo.${tipo}`)}: ${valorPorExtenso(absoluto)}`}
            className={cn('text-5xl font-bold tracking-tight tabular-nums', corValor)}
          >
            {entrada ? '+' : '−'}
            {formatarBRL(absoluto)}
          </p>
        </div>

        <div className={LINHA}>
          <p className={ROTULO}>{t('descricao')}</p>
          <p className={VALOR_LINHA}>{fala.descricao}</p>
        </div>

        <div className={LINHA}>
          <Label htmlFor="voz-favorecido" className={ROTULO}>
            {entrada ? t('de') : t('para')}
          </Label>
          <Input
            id="voz-favorecido"
            autoComplete="off"
            placeholder={entrada ? t('deQuem') : t('paraQuem')}
            className="h-14 text-2xl font-semibold md:text-2xl"
            value={favorecido}
            onChange={(e) => setFavorecido(e.target.value)}
          />
        </div>

        <div className={LINHA}>
          <p className={ROTULO}>{t('data')}</p>
          <p className={VALOR_LINHA}>{dataPorExtenso(fala.data, hojeLocal())}</p>
        </div>

        <div className={LINHA}>
          <Label className={ROTULO}>{t('conta')}</Label>
          {semConta ? (
            <p className="text-lg">
              {t('semContaTexto')}{' '}
              <Link href={`/w/${dados.workspaceId}/config`} onClick={aoFechar} className="font-semibold underline">
                {tr('semContaLink')}
              </Link>
            </p>
          ) : (
            <Select value={contaId} items={itensConta} onValueChange={(v) => setContaId(v ?? contaId)}>
              <SelectTrigger className="h-14 w-full text-xl font-semibold" aria-label={t('conta')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itensConta.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="min-h-12 text-lg">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className={LINHA}>
          <p className={ROTULO}>{t('categoria')}</p>
          <p className={cn(VALOR_LINHA, !categoria && 'font-normal text-muted-foreground')}>
            {categoria?.nome ?? t('semCategoria')}
          </p>
        </div>

        <p className="pt-3 text-base text-muted-foreground">{t('ouvi', { texto: `“${texto}”` })}</p>

        {erro && (
          <p role="alert" className="pt-3 text-lg font-medium text-destructive">
            {erro}
          </p>
        )}
      </div>

      <div className="border-t bg-background px-6 pt-3 pb-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          <Button
            type="button"
            disabled={pendente || semConta}
            onClick={salvar}
            className="h-16 w-full bg-marca text-xl font-semibold text-marca-foreground hover:bg-marca/90"
          >
            {pendente ? t('salvando') : t('estaCerto')}
          </Button>
          <Button type="button" variant="outline" disabled={pendente} onClick={aoFalarDeNovo} className="h-14 w-full text-lg">
            {t('falarDeNovo')}
          </Button>
          <button
            type="button"
            disabled={pendente}
            onClick={corrigir}
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              'h-12 self-center text-base font-medium underline underline-offset-4',
            )}
          >
            {t('corrigir')}
          </button>
        </div>
      </div>
    </>
  )
}
