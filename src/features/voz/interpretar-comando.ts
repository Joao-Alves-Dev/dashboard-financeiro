import { palavrasDoPeriodo, periodoNosTokens } from '@/features/exportacao/periodos'
import type { TipoExportacao } from '@/features/exportacao/relatorio'
import { lerNome, tokenizar } from './interpretar-fala'

export type Comando =
  | { tipo: 'lancamento' }
  | { tipo: 'exportar'; favorecido: string; de: string; ate: string; filtroTipo: TipoExportacao } // favorecido '' = todos
  // Extensão do plano: guarda o que já foi entendido, para a pergunta do período não perder o favorecido.
  | { tipo: 'exportar_incompleto'; falta: 'periodo'; favorecido: string; filtroTipo: TipoExportacao }

const VERBOS_EXPORTAR = new Set(['exporte', 'exportar', 'exporta', 'exportando', 'exportacao'])
// "relatório" sozinho já é pedido de exportação (decisão do spec).
const SUBSTANTIVOS_SOZINHOS = new Set(['relatorio', 'relatorios'])
const VERBOS_ENVIO = new Set([
  'gerar', 'gera', 'gere', 'fazer', 'faz', 'faca', 'mande', 'manda', 'mandar', 'envie', 'envia', 'enviar', 'imprimir',
  'imprima', 'compartilhar', 'compartilhe',
])
const SUBSTANTIVOS = new Set(['lista', 'listas', 'listagem', 'extrato', 'transacoes', 'relatorio', 'relatorios'])

const PALAVRAS_ENTRADA = new Set([
  'recebi', 'recebido', 'recebidos', 'recebimento', 'recebimentos', 'recebeu', 'entrou', 'entrada', 'entradas', 'receitas',
])
const PALAVRAS_SAIDA = new Set([
  'saida', 'saidas', 'pagamento', 'pagamentos', 'pagos', 'paguei', 'gastos', 'gastei', 'despesas',
])
const PALAVRAS_TUDO = new Set(['tudo', 'extrato', 'movimentacao', 'movimentacoes'])

// Palavras do próprio pedido: ficam fora do nome ("lista de pagamentos do Jeová" → Jeová).
const RUIDO = new Set([
  ...VERBOS_EXPORTAR, ...VERBOS_ENVIO, ...SUBSTANTIVOS, ...PALAVRAS_ENTRADA, ...PALAVRAS_SAIDA, ...PALAVRAS_TUDO,
  'me', 'por', 'favor', 'pode', 'poderia', 'quero', 'queria', 'preciso', 'gostaria', 'transacao', 'pagamento',
  'movimentacoes',
])
const INTRODUTORES_NOME = new Map([
  ['para', true],
  ['pra', true],
  ['pro', false],
  ['do', false],
  ['da', false],
  ['de', false],
])

/**
 * Decide o que a frase pede. Sem verbo de exportação ("exporte", "gerar lista", "manda a lista",
 * "relatório"…) a frase é um lançamento, mesmo que cite favorecido e datas.
 *
 * Favorecido x período: o período é removido primeiro, junto com a preposição que o antecede
 * ("de 29 de setembro", "do mês passado", "deste mês"); só então se procura "para/pra/pro/do/da/de"
 * seguido de nome. Assim, "de" + número ou mês é sempre período, e "de João" é favorecido. O nome sai
 * com capitalização de nome próprio e sem tratamento, como no lançamento por voz.
 */
export function interpretarComando(texto: string, hoje: string): Comando {
  const t = tokenizar(texto)
  const ls = t.map((x) => x.l)
  const exporta =
    ls.some((l) => VERBOS_EXPORTAR.has(l) || SUBSTANTIVOS_SOZINHOS.has(l)) ||
    (ls.some((l) => VERBOS_ENVIO.has(l)) && ls.some((l) => SUBSTANTIVOS.has(l)))
  if (!exporta) return { tipo: 'lancamento' }

  const temEntrada = ls.some((l) => PALAVRAS_ENTRADA.has(l))
  const temSaida = ls.some((l) => PALAVRAS_SAIDA.has(l))
  const temTudo = ls.some((l) => PALAVRAS_TUDO.has(l))
  // Entradas e saídas citadas juntas (ou "tudo") pedem as duas; sem pista, o padrão é saídas.
  const filtroTipo: TipoExportacao =
    temEntrada && temSaida ? 'todas' : temEntrada ? 'entradas' : temSaida ? 'saidas' : temTudo ? 'todas' : 'saidas'

  const periodo = periodoNosTokens(palavrasDoPeriodo(texto), hoje)
  if (periodo) for (let k = periodo.ini; k < periodo.fim; k++) t[k].rem = true
  for (const x of t) if (RUIDO.has(x.l)) x.rem = true

  let favorecido = ''
  for (let i = 0; i < t.length && !favorecido; i++) {
    const pulaArtigo = INTRODUTORES_NOME.get(t[i].l)
    if (t[i].rem || pulaArtigo === undefined) continue
    favorecido = lerNome(t, i + 1, pulaArtigo) ?? ''
  }

  if (!periodo) return { tipo: 'exportar_incompleto', falta: 'periodo', favorecido, filtroTipo }
  return { tipo: 'exportar', favorecido, de: periodo.de, ate: periodo.ate, filtroTipo }
}
