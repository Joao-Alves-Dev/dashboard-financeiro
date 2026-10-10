import { diasNoMes, montarDataIso } from '@/features/importacao/datas'
import { semAcento } from './numeros-extenso'

/** Datas por aritmética de string (sem `Date`, sem fuso). */

const MESES = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro',
  'dezembro',
]
export const NOMES_MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro',
  'dezembro',
]

/** "setembro" / "março" / "marco" -> número do mês (1-12); desconhecido -> null. */
export function numeroDoMes(nome: string): number | null {
  const i = MESES.indexOf(semAcento(nome).trim())
  return i === -1 ? null : i + 1
}

function partes(iso: string): { a: number; m: number; d: number } {
  const [a, m, d] = iso.split('-').map(Number)
  return { a, m, d }
}

/** Dias desde 1970-01-01 (calendário gregoriano proléptico; algoritmo de Howard Hinnant). */
function paraDias(a: number, m: number, d: number): number {
  const y = m <= 2 ? a - 1 : a
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

function dePDias(z0: number): { a: number; m: number; d: number } {
  const z = z0 + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const a = yoe + era * 400 + (m <= 2 ? 1 : 0)
  return { a, m, d }
}

/** Soma (ou subtrai) dias de uma data 'YYYY-MM-DD'. */
export function somarDias(iso: string, n: number): string {
  const { a, m, d } = partes(iso)
  const r = dePDias(paraDias(a, m, d) + n)
  return `${String(r.a).padStart(4, '0')}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`
}

/**
 * Resolve "dia N", "dia N de <mês>" e "dia N de <mês> de <ano>" em relação a `hoje`.
 *  - Sem mês: mês corrente; se o dia ainda não chegou (N > dia de hoje), vale o mês anterior mais
 *    recente em que o dia exista (dia 31 em março cai em janeiro se fevereiro não tem 31).
 *  - Com mês e sem ano: ano corrente; se a data ficar no futuro, ano anterior.
 *  - Com ano: o ano dado.
 * Data inexistente -> null.
 */
export function diaMesParaData(dia: number, mes: number | null, ano: number | null, hoje: string): string | null {
  const h = partes(hoje)
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null
  if (mes === null) {
    let a = h.a
    let m = h.m
    // Dia que ainda não chegou neste mês: começa a procurar no mês anterior.
    if (dia > h.d) {
      m -= 1
      if (m === 0) {
        m = 12
        a -= 1
      }
    }
    for (let i = 0; i < 12; i++) {
      if (dia <= diasNoMes(a, m)) return montarDataIso(a, m, dia)
      m -= 1
      if (m === 0) {
        m = 12
        a -= 1
      }
    }
    return null
  }
  if (ano !== null) return montarDataIso(ano, mes, dia)
  const atual = montarDataIso(h.a, mes, dia)
  if (atual === null) return null
  return atual > hoje ? montarDataIso(h.a - 1, mes, dia) : atual
}

/** '2026-10-08' com hoje '2026-10-08' -> "hoje, 8 de outubro"; outras datas: "29 de setembro" (+ " de 2025" se o ano difere). */
export function dataPorExtenso(iso: string, hoje: string): string {
  const { a, m, d } = partes(iso)
  const base = `${d === 1 ? '1º' : d} de ${NOMES_MESES[m - 1]}`
  const completo = a === partes(hoje).a ? base : `${base} de ${a}`
  if (iso === hoje) return `hoje, ${completo}`
  if (iso === somarDias(hoje, -1)) return `ontem, ${completo}`
  if (iso === somarDias(hoje, -2)) return `anteontem, ${completo}`
  return completo
}
