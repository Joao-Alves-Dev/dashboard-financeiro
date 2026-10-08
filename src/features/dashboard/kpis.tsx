import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import { formatarVariacao } from './formatar'
import { obterKpis } from './queries'
import { rotuloMesLongo, inicioDoMes } from './periodo'

type Sentido = 'subir-bom' | 'subir-ruim'

/**
 * Tile de KPI reutilizável: rótulo, valor e (opcional) variação vs. período anterior.
 * A direção da variação nunca depende só de cor: há glifo (▲/▼) e o texto traz o sinal.
 */
export function KpiTile({
  rotulo,
  valor,
  ajuda,
  variacao,
  sentido,
  textoVariacao,
  textoSemComparacao,
  textoIgual,
}: {
  rotulo: string
  valor: string
  ajuda?: string
  variacao?: number | null
  sentido?: Sentido
  textoVariacao?: (pct: string) => string
  textoSemComparacao?: string
  textoIgual?: string
}) {
  let delta: ReactNode = null
  if (variacao !== undefined) {
    if (variacao === null) {
      delta = <span className="text-muted-foreground">{textoSemComparacao}</span>
    } else if (variacao === 0) {
      delta = <span className="text-muted-foreground">{textoIgual}</span>
    } else {
      const subiu = variacao > 0
      const bom = (sentido ?? 'subir-bom') === 'subir-bom' ? subiu : !subiu
      const pct = formatarVariacao(variacao)
      delta = (
        <span className="flex items-center gap-1 text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn('text-[0.7rem] leading-none', bom ? 'text-(--status-bom)' : 'text-(--status-critico)')}
          >
            {subiu ? '▲' : '▼'}
          </span>
          <span>{textoVariacao ? textoVariacao(pct) : pct}</span>
        </span>
      )
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10" title={ajuda}>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{valor}</p>
      {delta ? <p className="min-h-4 text-xs">{delta}</p> : <p className="min-h-4 text-xs" aria-hidden="true" />}
    </div>
  )
}

export async function KpisBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, k] = await Promise.all([getTranslations('dashboard.kpis'), obterKpis(ws, hoje)])
  const vs = (pct: string) => t('vsAnterior', { pct })
  const comum = { textoVariacao: vs, textoSemComparacao: t('semComparacao'), textoIgual: t('igual') }
  return (
    <section aria-label={`${t('grupo')} — ${rotuloMesLongo(inicioDoMes(hoje))}`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile rotulo={t('saldoAtual')} valor={formatarBRL(k.saldoAtual)} ajuda={t('saldoAtualAjuda')} />
        <KpiTile rotulo={t('entradasMes')} valor={formatarBRL(k.mes.entradas)} variacao={k.variacao.entradas} sentido="subir-bom" {...comum} />
        <KpiTile rotulo={t('saidasMes')} valor={formatarBRL(k.mes.saidas)} variacao={k.variacao.saidas} sentido="subir-ruim" {...comum} />
        <KpiTile rotulo={t('resultadoMes')} valor={formatarBRL(k.mes.resultado)} variacao={k.variacao.resultado} sentido="subir-bom" {...comum} />
      </div>
    </section>
  )
}
