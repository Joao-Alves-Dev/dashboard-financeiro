import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, TrendingUpIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { SituacaoMeta } from './calcular-meta'

const ICONE = {
  no_ritmo: TrendingUpIcon,
  atrasada: AlertTriangleIcon,
  concluida: CheckCircle2Icon,
  vencida: ClockIcon,
} as const

/** Situação da meta sempre com ícone + texto (nunca só cor). */
export function SituacaoMetaRotulo({ situacao, className }: { situacao: SituacaoMeta; className?: string }) {
  const t = useTranslations('metas.situacao')
  const Icone = ICONE[situacao]
  const critico = situacao === 'atrasada' || situacao === 'vencida'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        critico ? 'text-(--status-critico)' : 'text-foreground',
        className,
      )}
    >
      <Icone aria-hidden="true" className="size-4 shrink-0" />
      {t(situacao)}
    </span>
  )
}
