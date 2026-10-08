export type GastoCategoria = { categoriaId: string | null; nome: string; cor: string | null; total: number }
export type GastoAgrupado = GastoCategoria & { agrupadas?: number }

/** Top `n` por total (decrescente) + uma linha "Outras" com a soma do resto, se houver mais de `n`. */
export function topComOutras(itens: GastoCategoria[], n: number, rotuloOutras = 'Outras'): GastoAgrupado[] {
  if (itens.length <= n) return itens
  const ord = [...itens].sort((a, b) => b.total - a.total)
  const resto = ord.slice(n)
  return [
    ...ord.slice(0, n),
    {
      categoriaId: null,
      nome: rotuloOutras,
      cor: null,
      total: resto.reduce((s, x) => s + x.total, 0),
      agrupadas: resto.length,
    },
  ]
}
