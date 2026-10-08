/**
 * Fuso do negócio: o usuário está no Brasil. Toda noção de "hoje" (mês corrente, janela de
 * 30 dias do contas a pagar/receber) usa este fuso, e não o do servidor (UTC na Vercel).
 * Em UTC, entre 21h e 24h de Brasília "hoje" já seria o dia seguinte.
 */
export const FUSO_NEGOCIO = 'America/Sao_Paulo'

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje em America/Sao_Paulo como 'YYYY-MM-DD'. `agora` existe para teste. */
export function hojeISO(agora: Date = new Date()): string {
  const p: Record<string, string> = {}
  for (const parte of formatador.formatToParts(agora)) p[parte.type] = parte.value
  return `${p.year}-${p.month}-${p.day}`
}
