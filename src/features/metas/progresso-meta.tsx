import { useTranslations } from 'next-intl'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { SituacaoMeta } from './calcular-meta'

/** Percentual inteiro (0-100) do guardado sobre o alvo; aritmética inteira, sem arredondar para cima de 100. */
export function percentualMeta(guardado: number, alvo: number): number {
  if (alvo <= 0) return 0
  return Math.max(0, Math.min(100, Math.floor((guardado * 100) / alvo)))
}

const COR: Record<SituacaoMeta, string> = {
  no_ritmo: 'var(--serie-1)',
  atrasada: 'var(--status-critico)',
  vencida: 'var(--status-critico)',
  concluida: 'var(--status-bom)',
}

/**
 * Barra de progresso acessível: `role="progressbar"` com valores e `aria-valuetext` ("45%: R$ 450,00 de R$ 1.000,00").
 * A cor reforça a situação, mas o estado também aparece em texto e ícone (SituacaoMeta) e o percentual é escrito.
 */
export function ProgressoMeta({
  nome,
  guardado,
  alvo,
  situacao,
  compacto,
}: {
  nome: string
  guardado: number
  alvo: number
  situacao: SituacaoMeta
  compacto?: boolean
}) {
  const t = useTranslations('metas')
  const pct = percentualMeta(guardado, alvo)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 tabular-nums">{t('guardadoDe', { guardado: formatarBRL(guardado), alvo: formatarBRL(alvo) })}</span>
        <span className="shrink-0 font-semibold tabular-nums">{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={nome}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={t('progressoTexto', { pct: `${pct}%`, guardado: formatarBRL(guardado), alvo: formatarBRL(alvo) })}
        className={cn(
          'overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--serie-1)_18%,transparent)]',
          compacto ? 'h-2' : 'h-2.5',
        )}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COR[situacao] }} />
      </div>
    </div>
  )
}
