import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { CardDashboard } from '@/features/dashboard/card-dashboard'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { ProgressoMeta } from './progresso-meta'
import { listarMetas } from './queries'
import { SituacaoMetaRotulo } from './situacao-meta'

const MAX_METAS = 3

/**
 * Card do dashboard: as 3 metas mais urgentes (vencidas/atrasadas primeiro, depois menor prazo; a ordem vem de
 * `listarMetas`), com mini-progresso e link para a tela de metas. Sem metas: estado vazio com link.
 */
export async function MetasResumoBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, metas] = await Promise.all([getTranslations('metas'), listarMetas(ws, hoje)])
  const href = `/w/${ws}/metas`
  const mostradas = metas.slice(0, MAX_METAS)

  return (
    <CardDashboard
      id="metas-resumo"
      titulo={t('dashboard.titulo')}
      descricao={mostradas.length > 0 ? t('dashboard.descricao') : undefined}
      acao={
        mostradas.length > 0 ? (
          <Link href={href} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t('dashboard.verTodas')}
          </Link>
        ) : null
      }
    >
      {mostradas.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-muted/50 px-4 py-5">
          <div>
            <p className="font-medium">{t('dashboard.vazioTitulo')}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.vazioTexto')}</p>
          </div>
          <Link href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('dashboard.criar')}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {mostradas.map((m) => (
            <li key={m.id} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{m.nome}</span>
                <SituacaoMetaRotulo situacao={m.calculo.situacao} className="shrink-0" />
              </div>
              <ProgressoMeta nome={m.nome} guardado={m.guardado} alvo={m.valorAlvoCentavos} situacao={m.calculo.situacao} compacto />
              {m.calculo.situacao === 'concluida' ? null : (
                <p className="text-xs text-muted-foreground">
                  {t('prazo', { data: formatarDataBR(m.dataAlvo) })}
                  <span aria-hidden="true"> · </span>
                  {t('necessario')}: <span className="tabular-nums">{formatarBRL(m.calculo.necessarioPorMes)}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardDashboard>
  )
}
