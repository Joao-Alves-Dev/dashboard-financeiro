/** Superfícies dos cards (tema claro/escuro) contra as quais a cor de uma categoria é validada. */
export const SUPERFICIE_CLARA = '#ffffff'
export const SUPERFICIE_ESCURA = '#171717'
const MIN_CONTRASTE = 3
const SLOTS = 8

function rgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminancia([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Razão de contraste WCAG entre duas cores #rrggbb. */
export function contraste(a: string, b: string): number {
  const ca = rgb(a)
  const cb = rgb(b)
  if (!ca || !cb) return 1
  const la = luminancia(ca)
  const lb = luminancia(cb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export type CorBarra = { tipo: 'categoria'; cor: string } | { tipo: 'slot'; slot: number }

/**
 * Usa a cor da categoria se a barra (elemento gráfico, mínimo 3:1) é visível nos dois temas;
 * senão cai no slot categórico fixo (--serie-N) do índice, que é validado nos dois temas.
 */
export function corDaBarra(cor: string | null, indice: number): CorBarra {
  const slot = (indice % SLOTS) + 1
  if (!cor || !rgb(cor)) return { tipo: 'slot', slot }
  if (contraste(cor, SUPERFICIE_CLARA) >= MIN_CONTRASTE && contraste(cor, SUPERFICIE_ESCURA) >= MIN_CONTRASTE) {
    return { tipo: 'categoria', cor }
  }
  return { tipo: 'slot', slot }
}
