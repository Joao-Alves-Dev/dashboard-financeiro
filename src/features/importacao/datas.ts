/**
 * Normalização de datas por aritmética de string (sem `new Date`, sem fuso).
 * Aceita dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd e aaaa/mm/dd.
 */
function bissexto(a: number): boolean {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
}

export function diasNoMes(a: number, m: number): number {
  if (m === 2) return bissexto(a) ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}

export function montarDataIso(a: number, m: number, d: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(m) || !Number.isInteger(d)) return null
  if (a < 1900 || a > 2200 || m < 1 || m > 12 || d < 1 || d > diasNoMes(a, m)) return null
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function normalizarDataBR(s: string): string | null {
  const t = s.trim()
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (m) return montarDataIso(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(t)
  if (m) return montarDataIso(Number(m[1]), Number(m[2]), Number(m[3]))
  return null
}
