import Link from 'next/link'
import { AlertTriangleIcon } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CardDashboard } from './card-dashboard'
import { formatarPercentual } from './formatar'
import { inicioDoMes, rotuloMesLongo } from './periodo'
import { obterOrcamentoDoMes } from './queries'

const MAX_LINHAS = 6

/** Progresso do orçamento do mês: azul até 100%; acima, vermelho com ícone e texto "Acima do orçamento". */
export async function OrcamentoResumoBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, linhas] = await Promise.all([getTranslations('dashboard.orcamento'), obterOrcamentoDoMes(ws, hoje)])
  const comOrcamento = linhas
    .filter((l) => l.orcado > 0 && l.percentual !== null)
    .sort((a, b) => (b.percentual ?? 0) - (a.percentual ?? 0) || a.nome.localeCompare(b.nome))
    .slice(0, MAX_LINHAS)
  const mes = rotuloMesLongo(inicioDoMes(hoje))
  const href = `/w/${ws}/orcamento`

  return (
    <CardDashboard
      id="orcamento-mes"
      titulo={t('titulo')}
      descricao={t('descricao', { mes })}
      acao={
        comOrcamento.length > 0 ? (
          <Link href={href} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {t('editar')}
          </Link>
        ) : null
      }
    >
      {comOrcamento.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-muted/50 px-4 py-5">
          <div>
            <p className="font-medium">{t('vazioTitulo')}</p>
            <p className="text-sm text-muted-foreground">{t('vazioTexto')}</p>
          </div>
          <Link href={href} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('definir')}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {comOrcamento.map((l) => {
            const pct = l.percentual ?? 0
            const estourou = pct > 100
            const valores = t('valores', { realizado: formatarBRL(l.realizado), orcado: formatarBRL(l.orcado) })
            return (
              <li key={l.categoriaId} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{l.nome}</span>
                  <span className={cn('shrink-0 font-semibold tabular-nums', estourou && 'text-(--status-critico)')}>
                    {formatarPercentual(pct)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={l.nome}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.round(pct))}
                  aria-valuetext={t('valorTexto', { pct: formatarPercentual(pct), realizado: formatarBRL(l.realizado), orcado: formatarBRL(l.orcado) })}
                  className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--serie-1)_18%,transparent)]"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      background: estourou ? 'var(--status-critico)' : 'var(--serie-1)',
                    }}
                  />
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {estourou ? (
                    <>
                      <AlertTriangleIcon aria-hidden="true" className="size-3.5 text-(--status-critico)" />
                      <span className="font-medium text-foreground">{t('acima')}</span>
                      <span aria-hidden="true">·</span>
                    </>
                  ) : null}
                  <span className="tabular-nums">{valores}</span>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </CardDashboard>
  )
}
