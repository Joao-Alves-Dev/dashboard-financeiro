import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { classeValor } from '@/lib/cores'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { CardDashboard, EstadoVazio } from './card-dashboard'
import { obterUltimosLancamentos } from './queries'

export async function UltimosLancamentosBloco({ ws }: { ws: string }) {
  const [t, itens] = await Promise.all([getTranslations('dashboard.recentes'), obterUltimosLancamentos(ws)])
  return (
    <CardDashboard
      id="ultimos-lancamentos"
      titulo={t('titulo')}
      acao={
        <Link href={`/w/${ws}/lancamentos`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t('verTodos')}
        </Link>
      }
    >
      {itens.length === 0 ? (
        <EstadoVazio>{t('vazio')}</EstadoVazio>
      ) : (
        <ul className="flex flex-col divide-y">
          {itens.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.descricao || '—'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatarDataBR(l.data)} · {l.categoriaNome ?? t('semCategoria')} · {l.contaNome}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`text-sm font-semibold tabular-nums ${classeValor(l.valorCentavos)}`}>
                  {formatarBRL(l.valorCentavos)}
                </span>
                {l.status === 'pendente' ? <Badge variant="outline">{t('pendente')}</Badge> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CardDashboard>
  )
}
