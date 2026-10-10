/**
 * Percentual inteiro para exibição quando um limite foi ULTRAPASSADO: arredonda ao mais próximo, mas nunca
 * mostra um valor igual ou abaixo do limite (15,4% contra limite 15 aparece como 16%, não "15%"), para o
 * texto não contradizer o alerta. A distorção fica restrita à faixa de meio ponto percentual.
 */
export function pctAcima(pctReal: number, limite: number): number {
  return Math.max(Math.round(pctReal), limite + 1)
}

/** Parte inteira de um percentual (para limiares do tipo "a partir de": 99,9% aparece como 99%). */
export function pctPiso(parte: number, total: number): number {
  return Math.floor((parte * 100) / total)
}
