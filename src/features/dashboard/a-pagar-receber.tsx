import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { classeValor } from '@/lib/cores'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { CardDashboard, EstadoVazio } from './card-dashboard'
import { obterContasAPagarReceber } from './queries'

/** Só para workspaces do tipo `empresa`: pendentes dos próximos 30 dias, a pagar (negativos) e a receber (positivos). */
export async function APagarReceberBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, d] = await Promise.all([getTranslations('dashboard.aPagarReceber'), obterContasAPagarReceber(ws, hoje)])
  const vazio = d.qtdAPagar + d.qtdAReceber === 0
  return (
    <CardDashboard
      id="a-pagar-receber"
      titulo={t('titulo')}
      descricao={t('descricao')}
      acao={
        <Link href={`/w/${ws}/lancamentos`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t('verPendentes')}
        </Link>
      }
    >
      {vazio ? (
        <EstadoVazio>{t('vazio')}</EstadoVazio>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">{t('aPagar')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatarBRL(d.totalAPagar)}</p>
              <p className="text-xs text-muted-foreground">{t('qtd', { n: d.qtdAPagar })}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">{t('aReceber')}</p>
              <p className="text-lg font-semibold tabular-nums">{formatarBRL(d.totalAReceber)}</p>
              <p className="text-xs text-muted-foreground">{t('qtd', { n: d.qtdAReceber })}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-medium">{t('proximos')}</h3>
            <ul className="flex flex-col divide-y">
              {d.proximos.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.descricao || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarDataBR(p.data)} · {p.valorCentavos < 0 ? t('aPagar') : t('aReceber')}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${classeValor(p.valorCentavos)}`}>
                    {formatarBRL(p.valorCentavos)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </CardDashboard>
  )
}
