export type SituacaoMeta = 'no_ritmo' | 'atrasada' | 'concluida' | 'vencida'

export type EntradaMeta = {
  /** Valor alvo em centavos (> 0). */
  alvo: number
  /** Total guardado em centavos (soma dos aportes; retiradas já descontadas). */
  guardado: number
  /** 'YYYY-MM-DD'. */
  dataAlvo: string
  /** 'YYYY-MM-DD' (America/Sao_Paulo, ver `hojeISO`). */
  hoje: string
  /** Sobra média mensal em centavos (pode ser negativa). */
  sobraMedia: number
}

export type CalculoMeta = {
  faltam: number
  mesesRestantes: number
  necessarioPorMes: number
  sobraMedia: number
  situacao: SituacaoMeta
}

/** Índice absoluto do mês (ano * 12 + mês - 1) de uma data 'YYYY-MM-DD', sem Date nem fuso. */
function indiceMes(iso: string): number {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso)
  if (!m) throw new Error(`data inválida: ${iso}`)
  return Number(m[1]) * 12 + Number(m[2]) - 1
}

/**
 * Meses restantes até a data alvo, CONTANDO O MÊS ATUAL e o mês da data alvo (ambos inclusive), com mínimo 1.
 * Só importa o mês de cada data (o dia não conta): de 2026-10-15 a 2027-09-30 são 12 (out/26 ... set/27);
 * data alvo no mês atual ou no passado = 1.
 */
export function mesesAte(hoje: string, dataAlvo: string): number {
  return Math.max(1, indiceMes(dataAlvo) - indiceMes(hoje) + 1)
}

/**
 * Situação e ritmo de uma meta de poupança.
 *  - `concluida`: guardado >= alvo (vale mesmo com prazo vencido); necessarioPorMes = 0.
 *  - `vencida`: não concluída e dataAlvo anterior a hoje (comparação de data inteira); necessarioPorMes = faltam.
 *  - `atrasada`: sobraMedia < necessarioPorMes (inclui sobra média negativa).
 *  - `no_ritmo`: sobraMedia >= necessarioPorMes.
 * `faltam` nunca é negativo; `necessarioPorMes` arredonda para cima ao centavo.
 */
export function calcularMeta(i: EntradaMeta): CalculoMeta {
  const faltam = Math.max(0, i.alvo - i.guardado)
  const mesesRestantes = mesesAte(i.hoje, i.dataAlvo)

  if (i.guardado >= i.alvo) {
    return { faltam: 0, mesesRestantes, necessarioPorMes: 0, sobraMedia: i.sobraMedia, situacao: 'concluida' }
  }
  const necessarioPorMes = Math.floor((faltam + mesesRestantes - 1) / mesesRestantes)
  const situacao: SituacaoMeta =
    i.dataAlvo < i.hoje ? 'vencida' : i.sobraMedia < necessarioPorMes ? 'atrasada' : 'no_ritmo'
  return { faltam, mesesRestantes, necessarioPorMes, sobraMedia: i.sobraMedia, situacao }
}
