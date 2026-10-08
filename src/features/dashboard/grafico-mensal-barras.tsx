'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'
import { formatarBRL } from '@/lib/money'
import { formatarBRLCompacto } from './formatar'
import type { PontoSerie } from './serie'

const COR_ENTRADAS = 'var(--serie-1)'
const COR_SAIDAS = 'var(--serie-2)'

type PayloadItem = { dataKey?: string | number; value?: number | string }

function ConteudoTooltip({
  active,
  payload,
  label,
  serie,
}: {
  active?: boolean
  payload?: PayloadItem[]
  label?: string | number
  serie: PontoSerie[]
}) {
  const t = useTranslations('dashboard.grafico')
  if (!active || !payload?.length) return null
  const ponto = serie.find((p) => p.rotulo === label)
  const linhas = [
    { chave: 'entradas', nome: t('entradas'), cor: COR_ENTRADAS },
    { chave: 'saidas', nome: t('saidas'), cor: COR_SAIDAS },
  ]
  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <p className="mb-1 text-xs text-muted-foreground">{ponto?.rotuloLongo ?? label}</p>
      <ul className="flex flex-col gap-1">
        {linhas.map((l) => {
          const v = Number(payload.find((p) => p.dataKey === l.chave)?.value ?? 0)
          return (
            <li key={l.chave} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-3 rounded" style={{ background: l.cor }} />
              <span className="font-semibold">{formatarBRL(v)}</span>
              <span className="text-muted-foreground">{l.nome}</span>
            </li>
          )
        })}
        {ponto ? (
          <li className="mt-1 flex items-center gap-2 border-t pt-1">
            <span aria-hidden="true" className="w-3" />
            <span className="font-semibold">{formatarBRL(ponto.resultado)}</span>
            <span className="text-muted-foreground">{t('resultado')}</span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

/**
 * Barras agrupadas entradas × saídas por mês (valores em centavos; o eixo mostra R$ compacto).
 * Cores: slots 1 (azul) e 2 (laranja) da paleta categórica, validados em claro e escuro; a identidade
 * não depende só de cor (legenda, tooltip rotulado e tabela de dados).
 */
export function GraficoMensalBarras({ serie }: { serie: PontoSerie[] }) {
  const t = useTranslations('dashboard.grafico')
  const totalEntradas = serie.reduce((s, p) => s + p.entradas, 0)
  const totalSaidas = serie.reduce((s, p) => s + p.saidas, 0)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex gap-4 text-sm" aria-label={t('titulo')}>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: COR_ENTRADAS }} />
          {t('entradas')}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-[3px]" style={{ background: COR_SAIDAS }} />
          {t('saidas')}
        </li>
      </ul>
      <figure
        className="m-0 h-64 w-full"
        role="group"
        aria-label={t('resumoAcessivel', { entradas: formatarBRL(totalEntradas), saidas: formatarBRL(totalSaidas) })}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={serie} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis
              dataKey="rotulo"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-eixo)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={4}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={(v: number) => formatarBRLCompacto(v)}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={(p) => (
                <ConteudoTooltip
                  active={p.active}
                  payload={p.payload as unknown as PayloadItem[]}
                  label={p.label}
                  serie={serie}
                />
              )}
            />
            <Bar dataKey="entradas" name={t('entradas')} fill={COR_ENTRADAS} maxBarSize={24} radius={[4, 4, 0, 0]} />
            <Bar dataKey="saidas" name={t('saidas')} fill={COR_SAIDAS} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('verTabela')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{t('titulo')}</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t('mes')}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t('entradas')}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t('saidas')}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t('resultado')}
                </th>
              </tr>
            </thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.mes} className="border-t">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {p.rotuloLongo}
                  </th>
                  <td className="py-1 pr-3 text-right tabular-nums">{formatarBRL(p.entradas)}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{formatarBRL(p.saidas)}</td>
                  <td className="py-1 text-right tabular-nums">{formatarBRL(p.resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
