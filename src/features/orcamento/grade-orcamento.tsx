'use client'

import { useId, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangleIcon, CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rotuloMesCurto, rotuloMesLongo } from '@/features/dashboard/periodo'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import { copiarMesAnterior, salvarOrcamento } from './actions'
import {
  formatarValorInput,
  interpretarValorOrcamento,
  situacaoCelula,
  type LinhaGrade,
  type TotalMes,
} from './grade'

type Props = {
  workspaceId: string
  meses: string[]
  linhas: LinhaGrade[]
  totais: TotalMes[]
}

type Estado = 'ocioso' | 'salvando' | 'salvo' | 'erro'

/** Realizado do mês com marcação "acima do orçado" por ícone + texto (não depende só de cor). */
function Realizado({ orcado, realizado, longo }: { orcado: number | null; realizado: number; longo?: boolean }) {
  const t = useTranslations('orcamento')
  const situacao = situacaoCelula(orcado, realizado)
  const acima = situacao === 'acima'
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground', acima && 'font-medium text-(--status-critico)')}>
      {acima ? <AlertTriangleIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span className="tabular-nums">{t('realizadoValor', { valor: formatarBRL(realizado) })}</span>
      {acima ? (
        <span>
          {longo ? t('acimaPor', { valor: formatarBRL(realizado - (orcado ?? 0)) }) : t('acima')}
        </span>
      ) : null}
    </p>
  )
}

type PropsCelula = {
  workspaceId: string
  categoriaId: string
  categoria: string
  mes: string
  orcado: number | null
  realizado: number
  longo?: boolean
}

/** Campo de orçado editável inline: salva ao sair do campo ou com Enter; mostra salvando/salvo/erro. */
function CelulaOrcamento({ workspaceId, categoriaId, categoria, mes, orcado, realizado, longo }: PropsCelula) {
  const t = useTranslations('orcamento')
  const idErro = useId()
  const [texto, setTexto] = useState(() => formatarValorInput(orcado))
  const [salvoTexto, setSalvoTexto] = useState(() => formatarValorInput(orcado))
  const [propAnterior, setPropAnterior] = useState(orcado)
  const [estado, setEstado] = useState<Estado>('ocioso')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Ressincroniza quando o servidor devolve outro valor (ex.: após "copiar mês anterior").
  if (propAnterior !== orcado) {
    setPropAnterior(orcado)
    const f = formatarValorInput(orcado)
    setTexto(f)
    setSalvoTexto(f)
  }

  function confirmar() {
    if (pendente || texto.trim() === salvoTexto.trim()) return
    const enviado = texto
    setEstado('salvando')
    setErro(null)
    iniciar(async () => {
      const r = await salvarOrcamento(workspaceId, categoriaId, mes, enviado)
      if (r.ok) {
        const v = interpretarValorOrcamento(enviado)
        const f = v.tipo === 'valor' ? formatarValorInput(v.centavos) : ''
        setTexto(f)
        setSalvoTexto(f)
        setEstado('salvo')
      } else {
        setErro(r.erro)
        setEstado('erro')
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          placeholder={t('placeholder')}
          aria-label={t('campoRotulo', { categoria, mes: rotuloMesLongo(mes) })}
          aria-invalid={estado === 'erro' || undefined}
          aria-describedby={estado === 'erro' ? idErro : undefined}
          onChange={(e) => {
            setTexto(e.target.value)
            if (estado !== 'ocioso') setEstado('ocioso')
          }}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={cn(
            'h-10 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-8 text-right text-base tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
            estado === 'erro' && 'border-destructive ring-3 ring-destructive/20',
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center" aria-live="polite">
          {estado === 'salvando' ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
          ) : null}
          {estado === 'salvo' ? <CheckIcon aria-hidden="true" className="size-4 text-muted-foreground" /> : null}
          <span className="sr-only">
            {estado === 'salvando' ? t('salvando') : estado === 'salvo' ? t('salvo') : ''}
          </span>
        </span>
      </div>
      {estado === 'erro' && erro ? (
        <p id={idErro} role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}
      <Realizado orcado={orcado} realizado={realizado} longo={longo} />
    </div>
  )
}

function BotaoCopiar({
  mes,
  pendente,
  onClick,
  compacto,
}: {
  mes: string
  pendente: boolean
  onClick: () => void
  compacto?: boolean
}) {
  const t = useTranslations('orcamento')
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={onClick}
      aria-label={t('copiarEm', { mes: rotuloMesLongo(mes) })}
      className={compacto ? 'w-full text-xs' : undefined}
    >
      <CopyIcon aria-hidden="true" />
      {pendente ? t('copiando') : compacto ? t('copiarCurto') : t('copiar')}
    </Button>
  )
}

export function GradeOrcamento({ workspaceId, meses, linhas, totais }: Props) {
  const t = useTranslations('orcamento')
  const [idxMobile, setIdxMobile] = useState(0)
  const [copiando, setCopiando] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null)
  const [, iniciar] = useTransition()
  const idSeletor = useId()

  const mesMobile = meses[Math.min(idxMobile, meses.length - 1)]
  const totalMobile = totais.find((x) => x.mes === mesMobile) ?? { mes: mesMobile, orcado: 0, realizado: 0 }

  function copiar(mes: string) {
    setCopiando(mes)
    setAviso(null)
    iniciar(async () => {
      const r = await copiarMesAnterior(workspaceId, mes)
      setCopiando(null)
      setAviso(
        r.ok
          ? { erro: false, texto: t('copiados', { n: r.data.copiados, mes: rotuloMesLongo(mes) }) }
          : { erro: true, texto: r.erro },
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite">
        {aviso ? (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              aviso.erro ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
            )}
          >
            {aviso.texto}
          </p>
        ) : null}
      </div>

      {/* Telas largas: grade categorias × 6 meses */}
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{t('titulo')}</caption>
          <thead>
            <tr className="border-b bg-muted/40 align-top">
              <th scope="col" className="w-44 p-3 text-left font-medium">
                {t('categoria')}
              </th>
              {meses.map((m) => (
                <th key={m} scope="col" className="p-2 text-left font-medium">
                  <div className="flex flex-col gap-2">
                    <span>{rotuloMesCurto(m, true)}</span>
                    <BotaoCopiar mes={m} pendente={copiando === m} onClick={() => copiar(m)} compacto />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.categoriaId} className="border-b align-top">
                <th scope="row" className="p-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: l.cor }} />
                    <span className="min-w-0 break-words">{l.nome}</span>
                  </span>
                </th>
                {l.celulas.map((c) => (
                  <td key={c.mes} className="p-2">
                    <CelulaOrcamento
                      workspaceId={workspaceId}
                      categoriaId={l.categoriaId}
                      categoria={l.nome}
                      mes={c.mes}
                      orcado={c.orcado}
                      realizado={c.realizado}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 align-top font-medium">
              <th scope="row" className="p-3 text-left">
                {t('totais')}
              </th>
              {totais.map((x) => (
                <td key={x.mes} className="p-3">
                  <p className="flex flex-col gap-0.5 tabular-nums">
                    <span>
                      <span className="sr-only">{t('totalOrcado')}: </span>
                      {formatarBRL(x.orcado)}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {t('realizadoValor', { valor: formatarBRL(x.realizado) })}
                    </span>
                  </p>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Celular e tablet: um mês por vez, sem rolagem horizontal */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idSeletor} className="text-sm font-medium">
            {t('seletorMes')}
          </label>
          <select
            id={idSeletor}
            value={mesMobile}
            onChange={(e) => setIdxMobile(Math.max(0, meses.indexOf(e.target.value)))}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {meses.map((m) => (
              <option key={m} value={m}>
                {rotuloMesLongo(m)}
              </option>
            ))}
          </select>
        </div>

        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
          {linhas.map((l) => {
            const c = l.celulas.find((x) => x.mes === mesMobile)
            if (!c) return null
            return (
              <li key={`${l.categoriaId}-${mesMobile}`} className="flex flex-col gap-2 p-3">
                <p className="flex items-center gap-2 font-medium">
                  <span aria-hidden="true" className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: l.cor }} />
                  <span className="min-w-0 break-words">{l.nome}</span>
                </p>
                <CelulaOrcamento
                  workspaceId={workspaceId}
                  categoriaId={l.categoriaId}
                  categoria={l.nome}
                  mes={mesMobile}
                  orcado={c.orcado}
                  realizado={c.realizado}
                  longo
                />
              </li>
            )
          })}
        </ul>

        <section aria-label={t('totais')} className="flex flex-col gap-1 rounded-xl bg-muted/40 p-3 text-sm">
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{t('totalOrcado')}</span>
            <span className="font-semibold tabular-nums">{formatarBRL(totalMobile.orcado)}</span>
          </p>
          <p className="flex items-baseline justify-between gap-3 text-muted-foreground">
            <span>{t('totalRealizado')}</span>
            <span className="tabular-nums">{formatarBRL(totalMobile.realizado)}</span>
          </p>
        </section>

        <BotaoCopiar mes={mesMobile} pendente={copiando === mesMobile} onClick={() => copiar(mesMobile)} />
      </div>

      <p className="text-xs text-muted-foreground">{t('ajuda')}</p>
    </div>
  )
}
