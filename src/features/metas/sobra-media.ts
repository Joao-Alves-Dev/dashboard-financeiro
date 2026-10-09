import { somarMeses, ultimoDiaDoMes } from '@/features/dashboard/periodo'

/** Quantos meses fechados entram na sobra média. */
export const MESES_SOBRA_MEDIA = 3

/**
 * Janela dos `qtd` meses FECHADOS: os que terminam antes do mês de `hoje` (o mês corrente nunca entra,
 * nem no dia 1). Ex.: hoje 2027-01-10 -> de 2026-10-01 a 2026-12-31.
 */
export function mesesFechados(hoje: string, qtd: number = MESES_SOBRA_MEDIA): { de: string; ate: string } {
  return { de: somarMeses(hoje, -qtd), ate: ultimoDiaDoMes(somarMeses(hoje, -1)) }
}

/** Média inteira (centavos) arredondada ao inteiro mais próximo, metades afastando de zero; lista vazia = 0. */
export function mediaArredondada(valores: number[]): number {
  if (valores.length === 0) return 0
  const soma = valores.reduce((a, b) => a + b, 0)
  const media = soma / valores.length
  return Math.sign(media) * Math.round(Math.abs(media))
}
