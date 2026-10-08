/**
 * Aritmética de datas 'YYYY-MM-DD' por inteiros (calendário gregoriano), sem fuso.
 * Só `somarDias` usa Date, em UTC puro (Date.UTC + getUTC*), que não tem horário de verão.
 */
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function partes(iso: string): { a: number; m: number; d: number } {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!x) throw new Error(`data inválida: ${iso}`)
  return { a: Number(x[1]), m: Number(x[2]), d: Number(x[3]) }
}

const p2 = (n: number) => String(n).padStart(2, '0')
const p4 = (n: number) => String(n).padStart(4, '0')

function bissexto(a: number): boolean {
  return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
}

function diasNoMes(a: number, m: number): number {
  if (m === 2) return bissexto(a) ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}

export function inicioDoMes(iso: string): string {
  const { a, m } = partes(iso)
  return `${p4(a)}-${p2(m)}-01`
}

export function ultimoDiaDoMes(iso: string): string {
  const { a, m } = partes(iso)
  return `${p4(a)}-${p2(m)}-${p2(diasNoMes(a, m))}`
}

/** Primeiro dia do mês `n` meses após (ou antes, se negativo) o mês de `iso`. */
export function somarMeses(iso: string, n: number): string {
  const { a, m } = partes(iso)
  const idx = a * 12 + (m - 1) + n
  const ano = Math.floor(idx / 12)
  return `${p4(ano)}-${p2(idx - ano * 12 + 1)}-01`
}

export function mesAnterior(iso: string): string {
  return somarMeses(iso, -1)
}

export function somarDias(iso: string, n: number): string {
  const { a, m, d } = partes(iso)
  const t = new Date(Date.UTC(a, m - 1, d + n))
  return `${p4(t.getUTCFullYear())}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`
}

/** Janela dos `qtd` últimos meses, incluindo o mês de `hoje`: do dia 1 de (hoje - qtd + 1) ao último dia do mês de hoje. */
export function intervaloUltimosMeses(hoje: string, qtd: number): { de: string; ate: string } {
  return { de: somarMeses(hoje, -(qtd - 1)), ate: ultimoDiaDoMes(hoje) }
}

/** 'dez' ou, com ano, 'jan/27'. */
export function rotuloMesCurto(iso: string, comAno: boolean): string {
  const { a, m } = partes(iso)
  const base = MESES_CURTOS[m - 1]
  return comAno ? `${base}/${p2(a % 100)}` : base
}

export function rotuloMesLongo(iso: string): string {
  const { a, m } = partes(iso)
  return `${MESES_LONGOS[m - 1]} de ${a}`
}
