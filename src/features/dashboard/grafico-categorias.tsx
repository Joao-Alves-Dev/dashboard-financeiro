import { getTranslations } from 'next-intl/server'
import { formatarBRL } from '@/lib/money'
import { CardDashboard, EstadoVazio } from './card-dashboard'
import { topComOutras } from './agrupar'
import { corDaBarra } from './cores'
import { formatarPercentual } from './formatar'
import { inicioDoMes, rotuloMesLongo } from './periodo'
import { obterGastosDoMes } from './queries'

export const TOP_CATEGORIAS = 8

/**
 * Barras horizontais em HTML (sem JS no cliente): nome e valor sempre visíveis (rótulo direto, nada de
 * cor-apenas), barra com no máximo 12px de espessura, extremidade de dados arredondada e base reta.
 * A cor é a da categoria quando tem contraste >= 3:1 nos dois temas; senão, o slot categórico fixo.
 */
export async function GraficoCategoriasBloco({ ws, hoje }: { ws: string; hoje: string }) {
  const [t, gastos] = await Promise.all([getTranslations('dashboard.categorias'), obterGastosDoMes(ws, hoje)])
  const itens = topComOutras(gastos, TOP_CATEGORIAS, t('outras'))
  const totalGeral = gastos.reduce((s, g) => s + g.total, 0)
  const maximo = Math.max(1, ...itens.map((i) => i.total))
  const mes = rotuloMesLongo(inicioDoMes(hoje))

  return (
    <CardDashboard id="gastos-categoria" titulo={t('titulo')} descricao={t('descricao', { mes })}>
      {itens.length === 0 ? (
        <EstadoVazio>{t('vazio')}</EstadoVazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((i, idx) => {
            const pct = totalGeral > 0 ? (i.total / totalGeral) * 100 : 0
            const cor = i.agrupadas ? null : corDaBarra(i.cor, idx)
            const fundo = i.agrupadas
              ? 'var(--muted-foreground)'
              : cor?.tipo === 'categoria'
                ? cor.cor
                : `var(--serie-${cor?.slot ?? 1})`
            const detalhe = i.agrupadas ? ` (${t('outrasQtd', { n: i.agrupadas })})` : ''
            return (
              <li
                key={i.categoriaId ?? 'outras'}
                title={`${i.nome}${detalhe}: ${formatarBRL(i.total)} — ${t('participacao', { pct: formatarPercentual(pct) })}`}
                className="flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {i.nome}
                    {i.agrupadas ? <span className="text-muted-foreground">{detalhe}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold">{formatarBRL(i.total)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatarPercentual(pct)}</span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-3 rounded-r-[4px] transition-opacity hover:opacity-80"
                  style={{ width: `${Math.max(1, (i.total / maximo) * 100)}%`, background: fundo }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </CardDashboard>
  )
}
