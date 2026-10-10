import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2Icon, InfoIcon, OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BotaoDispensar } from './botao-dispensar'
import type { Alerta, Severidade } from './tipos'

const ICONE: Record<Severidade, LucideIcon> = {
  critico: OctagonAlertIcon,
  atencao: TriangleAlertIcon,
  info: InfoIcon,
  positivo: CheckCircle2Icon,
}

// Cor só reforça: ícone e texto da severidade sempre aparecem.
const COR_ICONE: Record<Severidade, string> = {
  critico: 'text-(--status-critico)',
  atencao: 'text-foreground',
  info: 'text-muted-foreground',
  positivo: 'text-(--status-bom)',
}

const BORDA: Record<Severidade, string> = {
  critico: 'border-l-(--status-critico)',
  atencao: 'border-l-foreground/70',
  info: 'border-l-border',
  positivo: 'border-l-(--status-bom)',
}

/**
 * Alerta do orientador: severidade (ícone + texto), título, texto com os números reais, "Entender" (leva à dica
 * ligada) e, na tela completa, "Dispensar". `compacto` (card do dashboard) mostra só título e link.
 */
export function CartaoAlerta({
  workspaceId,
  alerta,
  compacto = false,
}: {
  workspaceId: string
  alerta: Alerta
  compacto?: boolean
}) {
  const t = useTranslations('orientador.alertas')
  const Icone = ICONE[alerta.severidade]
  const href = `/w/${workspaceId}/orientacoes/${alerta.dicaId}`

  return (
    <article
      className={cn('flex min-w-0 flex-col gap-2 rounded-lg border border-l-4 bg-card p-3', BORDA[alerta.severidade])}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Icone aria-hidden="true" className={cn('size-4 shrink-0', COR_ICONE[alerta.severidade])} />
        {t(`severidade.${alerta.severidade}`)}
      </p>
      <h3 className="text-base leading-snug font-medium break-words">{alerta.titulo}</h3>
      {compacto ? null : <p className="text-sm leading-relaxed break-words">{alerta.texto}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href}
          aria-label={t('entenderAria', { titulo: alerta.titulo })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('entender')}
        </Link>
        {compacto ? null : <BotaoDispensar workspaceId={workspaceId} alerta={alerta} />}
      </div>
    </article>
  )
}
