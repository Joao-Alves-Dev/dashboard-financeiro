import { PERIODO_TUDO, palavrasDoPeriodo, periodoNosTokens } from '@/features/exportacao/periodos'
import type { TipoExportacao } from '@/features/exportacao/relatorio'
import { resolverFavorecidoConhecido, type OpcoesInterpretacao } from './favorecido-conhecido'
import { lerNome, tokenizar, type Tok } from './interpretar-fala'

export type Comando =
  | { tipo: 'lancamento' }
  | {
      tipo: 'exportar'
      /** '' = todos. */
      favorecido: string
      de: string
      ate: string
      filtroTipo: TipoExportacao
      /** Sem período na fala = TODAS as transações (Task 15d): `de`/`ate` são `PERIODO_TUDO` e isto vale `true`. */
      todoPeriodo?: true
    }

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
const PALAVRAS_TUDO = new Set(['tudo', 'extrato', 'movimentacao', 'movimentacoes', 'todas', 'todos'])

// Palavras do próprio pedido: ficam fora do nome ("lista de pagamentos do Jerônimo" → Jerônimo).
const RUIDO = new Set([
  ...VERBOS_EXPORTAR, ...VERBOS_ENVIO, ...SUBSTANTIVOS, ...PALAVRAS_ENTRADA, ...PALAVRAS_SAIDA, ...PALAVRAS_TUDO,
  'me', 'por', 'favor', 'pode', 'poderia', 'quero', 'queria', 'preciso', 'gostaria', 'transacao', 'pagamento',
  'movimentacoes', 'efetuada', 'efetuadas', 'efetuado', 'efetuados', 'feita', 'feitas', 'feito', 'feitos', 'completo',
  'completa', 'geral', 'detalhado', 'pdf', 'png', 'imagem', 'arquivo', 'planilha', 'meu', 'minha', 'meus', 'minhas',
  'todo', 'toda',
])
// Palavras que não começam um nome: artigos, preposições e conectores (fallback de nome desconhecido).
const NAO_INICIAM_NOME = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
  'para', 'pra', 'pro', 'pelo', 'pela', 'com', 'sem', 'que', 'foram', 'sao', 'por', 'sobre',
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
 * com capitalização de nome próprio e sem tratamento, como no lançamento por voz. Com
 * `opcoes.favorecidosConhecidos`, é reconhecido contra os nomes cadastrados (`resolverFavorecidoConhecido`).
 */
export function interpretarComando(texto: string, hoje: string, opcoes?: OpcoesInterpretacao): Comando {
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

  const conhecidos = opcoes?.favorecidosConhecidos ?? []
  let favorecido = ''

  // 1) Nome já cadastrado em QUALQUER posição da frase (palavras inteiras; maior nome primeiro).
  const achado = acharConhecido(t, conhecidos)
  if (achado) {
    // "maria josé" com "Maria" cadastrada é outra pessoa: a regra dos conhecidos decide se o nome continua.
    const candidato = lerNome(t, achado.ini, false)
    favorecido = candidato ? resolverFavorecidoConhecido(candidato, conhecidos) : achado.nome
  }
  // 2) Preposição + nome ("para o Jerônimo", "do João"), para nomes ainda desconhecidos.
  for (let i = 0; i < t.length && !favorecido; i++) {
    const pulaArtigo = INTRODUTORES_NOME.get(t[i].l)
    if (t[i].rem || pulaArtigo === undefined) continue
    favorecido = lerNome(t, i + 1, pulaArtigo) ?? ''
  }
  // 3) O que sobrou da frase, sem preposição ("exporte transações efetuadas ricardo"): um nome desconhecido
  // é mantido, para o app mostrar nomes parecidos. Nunca vira "todos" por engano (a lista iria para a pessoa errada).
  for (let i = 0; i < t.length && !favorecido; i++) {
    if (t[i].rem || t[i].l === '' || NAO_INICIAM_NOME.has(t[i].l) || /\d/.test(t[i].l)) continue
    favorecido = lerNome(t, i, false) ?? ''
  }
  if (favorecido) favorecido = resolverFavorecidoConhecido(favorecido, conhecidos)

  // Sem período na fala: vale TODO o período (e a lista traz o intervalo real das linhas).
  if (!periodo) return { tipo: 'exportar', favorecido, ...PERIODO_TUDO, filtroTipo, todoPeriodo: true }
  return { tipo: 'exportar', favorecido, de: periodo.de, ate: periodo.ate, filtroTipo }
}

/**
 * Procura, nas palavras livres da frase, o favorecido cadastrado: compara a chave (palavras já sem acento e
 * sem tratamento) com palavras inteiras consecutivas. Vence o nome de MAIS palavras; em empate, o que aparece antes.
 */
function acharConhecido(t: Tok[], conhecidos: { chave: string; nome: string }[]): { nome: string; ini: number } | null {
  let melhor: { nome: string; ini: number; n: number } | null = null
  for (const c of conhecidos) {
    const kw = c.chave.split(' ').filter(Boolean)
    if (kw.length === 0) continue
    for (let i = 0; i + kw.length <= t.length; i++) {
      if (!kw.every((w, j) => !t[i + j].rem && t[i + j].l === w)) continue
      if (!melhor || kw.length > melhor.n || (kw.length === melhor.n && i < melhor.ini)) {
        melhor = { nome: c.nome, ini: i, n: kw.length }
      }
      break
    }
  }
  return melhor
}
