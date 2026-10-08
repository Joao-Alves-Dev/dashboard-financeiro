/** Variação percentual de `atual` sobre `anterior` (pela magnitude do anterior); nula se anterior = 0. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  // arredonda a 2 casas: remove ruído de ponto flutuante (220.00000000000003)
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 10000) / 100
}

const fVariacao = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

/** 12.5 -> '+12,5%'; null -> '—'. */
export function formatarVariacao(pct: number | null): string {
  if (pct === null) return '—'
  return fVariacao.format(pct / 100)
}

const fPercentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export function formatarPercentual(pct: number): string {
  return fPercentual.format(pct / 100)
}

const fCompacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Eixo de gráfico: centavos -> 'R$ 1,5 mil'. */
export function formatarBRLCompacto(centavos: number): string {
  return fCompacto.format(centavos / 100)
}
