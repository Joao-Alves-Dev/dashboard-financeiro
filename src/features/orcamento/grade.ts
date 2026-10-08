import { parseValorBR } from '@/lib/money'
import { inicioDoMes, somarMeses } from '@/features/dashboard/periodo'

/**
 * Helpers puros da grade de orçamento (sem banco). Meses são sempre 'YYYY-MM-01'; dinheiro em centavos.
 */

/** Quantos meses a grade mostra por vez. */
export const QTD_MESES_GRADE = 6

/** Maior orçamento aceito: R$ 999.999.999,99 (cabe folgado em bigint e em Number). */
export const MAX_ORCAMENTO_CENTAVOS = 99_999_999_999

const ANO_MIN = 2000
const ANO_MAX = 2100

function diasNoMes(a: number, m: number): number {
  if (m === 2) return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}

/**
 * Normaliza 'YYYY-MM-DD' (data válida de qualquer dia) ou 'YYYY-MM' para o dia 1 do mês.
 * Devolve null para formato/data inválidos ou ano fora de 2000-2100. Sem Date: nada de fuso.
 */
export function normalizarMes(s: string): string | null {
  const x = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s.trim())
  if (!x) return null
  const a = Number(x[1])
  const m = Number(x[2])
  if (a < ANO_MIN || a > ANO_MAX || m < 1 || m > 12) return null
  if (x[3] !== undefined) {
    const d = Number(x[3])
    if (d < 1 || d > diasNoMes(a, m)) return null
  }
  return `${x[1]}-${x[2]}-01`
}

/** `qtd` meses consecutivos a partir do mês de `inicial` (que é normalizado para o dia 1). */
export function mesesConsecutivos(inicial: string, qtd: number): string[] {
  const base = inicioDoMes(inicial)
  return Array.from({ length: qtd }, (_, i) => somarMeses(base, i))
}

/** Mês inicial vindo de `?mes=`: o parâmetro (se válido e único) ou o mês de `hoje`. */
export function lerMesInicial(param: string | string[] | undefined, hoje: string): string {
  if (typeof param === 'string') {
    const m = normalizarMes(param)
    if (m) return m
  }
  return inicioDoMes(hoje)
}

export type ValorOrcamento =
  | { tipo: 'apagar' }
  | { tipo: 'valor'; centavos: number }
  | { tipo: 'erro'; motivo: 'invalido' | 'negativo' | 'grande' }

/**
 * Interpreta o texto digitado na célula. Vazio apaga o orçamento; "0" grava orçamento zero
 * ("não gastar nada nesta categoria"), que é diferente de não ter orçamento.
 */
export function interpretarValorOrcamento(texto: string): ValorOrcamento {
  if (texto.trim() === '') return { tipo: 'apagar' }
  const c = parseValorBR(texto)
  if (c === null) return { tipo: 'erro', motivo: 'invalido' }
  if (c < 0) return { tipo: 'erro', motivo: 'negativo' }
  if (c > MAX_ORCAMENTO_CENTAVOS) return { tipo: 'erro', motivo: 'grande' }
  return { tipo: 'valor', centavos: c }
}

const fInput = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Texto do campo: '1.234,56' (sem símbolo); sem orçamento (null) = vazio. */
export function formatarValorInput(centavos: number | null): string {
  return centavos === null ? '' : fInput.format(centavos / 100)
}

export type CelulaGrade = {
  mes: string
  /** null = sem orçamento definido; 0 = orçamento zero gravado. */
  orcado: number | null
  /** Despesa efetivada do mês, positiva. */
  realizado: number
}

export type LinhaGrade = {
  categoriaId: string
  nome: string
  cor: string
  celulas: CelulaGrade[]
}

export type SituacaoCelula = 'sem_orcamento' | 'dentro' | 'acima'

export function situacaoCelula(orcado: number | null, realizado: number): SituacaoCelula {
  if (orcado === null) return 'sem_orcamento'
  return realizado > orcado ? 'acima' : 'dentro'
}

export type TotalMes = { mes: string; orcado: number; realizado: number }

/** Soma orçado (ausente conta 0) e realizado de todas as categorias, por mês. */
export function calcularTotais(linhas: LinhaGrade[], meses: string[]): TotalMes[] {
  return meses.map((mes) => {
    let orcado = 0
    let realizado = 0
    for (const l of linhas) {
      const c = l.celulas.find((x) => x.mes === mes)
      if (!c) continue
      orcado += c.orcado ?? 0
      realizado += c.realizado
    }
    return { mes, orcado, realizado }
  })
}
