import { parseValorBR } from '@/lib/money'
import { TRATAMENTOS } from '@/features/favorecido/normalizar'
import { diaMesParaData, numeroDoMes, somarDias } from './datas-fala'
import { ehPalavraNumerica, extensoParaNumero, semAcento } from './numeros-extenso'

export type FalaInterpretada =
  | { ok: true; valorCentavos: number; descricao: string; data: string; favorecido?: string }
  | { ok: false; motivo: 'vazio' | 'sem_valor' }

export const DESCRICAO_PADRAO = 'Lançamento por voz'
const DESCRICAO_MAX = 200
const FAVORECIDO_MAX = 80

type Tok = {
  /** Palavra como falada (acentos, maiúsculas e pontuação preservados). */
  orig: string
  /** Minúsculas, sem acento e sem pontuação nas pontas ("R$" mantém o cifrão). */
  l: string
  /** Fora da descrição: valor, data, palavras de comando. */
  rem: boolean
}

const PONTAS = /^[^\p{L}\p{N}$]+|[^\p{L}\p{N}$]+$/gu

function tokenizar(texto: string): Tok[] {
  return (texto.normalize('NFC').match(/\S+/g) ?? []).map((orig) => ({
    orig,
    l: semAcento(orig).replace(PONTAS, ''),
    rem: false,
  }))
}

const PREPOSICOES_ANTES_DE_DATA = new Set(['no', 'na', 'em', 'do', 'da'])
const PREPOSICOES_ANTES_DE_VALOR = new Set(['de', 'do', 'da', 'no', 'na', 'em', 'por', 'valor'])
const COMANDOS_ENTRADA = new Set(['recebi', 'recebimento', 'recebido', 'entrou'])
const COMANDOS_SAIDA = new Set(['paguei', 'pago', 'pagamento', 'gastei'])
const DE_DO_DA = new Set(['de', 'do', 'da'])
const MULTIPLICADORES = new Map([
  ['mil', 1000],
  ['milhao', 1_000_000],
  ['milhoes', 1_000_000],
])

// ---------- datas ----------

function extrairData(t: Tok[], hoje: string): string | null {
  let data: string | null = null
  const marcar = (de: number, ate: number) => {
    for (let k = de; k < ate; k++) t[k].rem = true
    // "no dia 20", "em dia 20": a preposição vai junto.
    if (de > 0 && !t[de - 1].rem && PREPOSICOES_ANTES_DE_DATA.has(t[de - 1].l)) t[de - 1].rem = true
  }
  for (let i = 0; i < t.length; i++) {
    if (t[i].rem) continue
    const l = t[i].l
    if (l === 'ontem' || l === 'anteontem' || l === 'hoje') {
      if (data === null) data = l === 'hoje' ? hoje : somarDias(hoje, l === 'ontem' ? -1 : -2)
      marcar(i, i + 1)
      continue
    }
    if (l !== 'dia' || data !== null) continue
    const dTok = t[i + 1]
    if (!dTok || dTok.rem || !/^\d{1,2}[ºo°]?$/.test(dTok.l)) continue
    const dia = parseInt(dTok.l, 10)
    let fim = i + 2
    let mes: number | null = null
    let ano: number | null = null
    if (t[fim]?.l === 'de' && t[fim + 1] && !t[fim + 1].rem) {
      const m = numeroDoMes(t[fim + 1].l)
      if (m !== null) {
        mes = m
        fim += 2
        if (t[fim]?.l === 'de' && /^\d{4}$/.test(t[fim + 1]?.l ?? '')) {
          ano = Number(t[fim + 1].l)
          fim += 2
        }
      }
    }
    const iso = diaMesParaData(dia, mes, ano, hoje)
    if (iso === null) continue
    data = iso
    marcar(i, fim)
  }
  return data
}

// ---------- valor ----------

type Quantia = { ini: number; fim: number; centavos: number; forte: boolean; extenso: boolean }

const EH_DIGITOS = /^\d+([.,]\d+)*$/

/** Maior prefixo de palavras numéricas a partir de `k` que forma um número válido (sem "e" sobrando no fim). */
function lerExtenso(t: Tok[], k: number): { valor: number; fim: number; temMil: boolean } | null {
  const idx: number[] = []
  for (let i = k; i < t.length && !t[i].rem; i++) {
    if (ehPalavraNumerica(t[i].l)) idx.push(i)
    else if (t[i].l === 'e' && t[i + 1] && !t[i + 1].rem && ehPalavraNumerica(t[i + 1].l)) idx.push(i)
    else break
  }
  for (let n = idx.length; n >= 1; n--) {
    if (t[idx[n - 1]].l === 'e') continue
    const v = extensoParaNumero(idx.slice(0, n).map((i) => t[i].l).join(' '))
    if (v !== null) {
      const temMil = idx.slice(0, n).some((i) => MULTIPLICADORES.has(t[i].l))
      return { valor: v, fim: idx[n - 1] + 1, temMil }
    }
  }
  return null
}

/** Inteiro pequeno (dígitos de 1 a 3 casas ou extenso < 1000) a partir de `k`. */
function lerPequeno(t: Tok[], k: number): { valor: number; fim: number } | null {
  const tk = t[k]
  if (!tk || tk.rem) return null
  if (/^\d{1,3}$/.test(tk.l)) return { valor: Number(tk.l), fim: k + 1 }
  const e = lerExtenso(t, k)
  return e && e.valor < 1000 && !e.temMil ? { valor: e.valor, fim: e.fim } : null
}

const livre = (t: Tok[], i: number): Tok | undefined => (t[i] && !t[i].rem ? t[i] : undefined)

function lerQuantia(t: Tok[], i: number): Quantia | null {
  if (t[i].rem) return null
  let j = i
  let forte = false
  let s = t[j].l
  if (s === 'r$') {
    forte = true
    j++
    if (!livre(t, j)) return null
    s = t[j].l
  } else if (s.startsWith('r$')) {
    forte = true
    s = s.slice(2)
  }

  let centavos: number
  let extenso = false
  if (EH_DIGITOS.test(s)) {
    const v = parseValorBR(s)
    if (v === null) return null
    centavos = v
    j++
    const mult = livre(t, j) ? MULTIPLICADORES.get(t[j].l) : undefined
    if (mult) {
      centavos *= mult
      forte = true
      j++
      if (mult >= 1_000_000 && t[j]?.l === 'de' && livre(t, j + 1) && /^(reais|real)$/.test(t[j + 1].l)) j++
      let k = j
      if (t[k]?.l === 'e') k++
      const sub = lerPequeno(t, k)
      if (sub) {
        centavos += sub.valor * 100
        j = sub.fim
      }
    }
  } else if (ehPalavraNumerica(s)) {
    const e = lerExtenso(t, j)
    if (!e) return null
    centavos = e.valor * 100
    extenso = true
    if (e.temMil) forte = true
    j = e.fim
  } else {
    return null
  }

  // "50 centavos": o número já são centavos.
  if (livre(t, j) && /^centavos?$/.test(t[j].l) && !forte) {
    return { ini: i, fim: j + 1, centavos: Math.round(centavos / 100), forte: true, extenso }
  }
  if (livre(t, j) && /^(reais|real)$/.test(t[j].l)) {
    forte = true
    j++
    let k = j
    if (t[k]?.l === 'e') k++
    const c = lerPequeno(t, k)
    if (c && c.valor <= 99 && livre(t, c.fim) && /^centavos?$/.test(t[c.fim].l)) {
      centavos += c.valor
      j = c.fim + 1
    }
  }
  return { ini: i, fim: j, centavos, forte, extenso }
}

/** Primeiro valor monetário da frase: com marca de dinheiro (R$, reais, centavos, mil), senão dígitos soltos, senão extenso. */
function extrairValor(t: Tok[]): Quantia | null {
  const candidatas: Quantia[] = []
  for (let i = 0; i < t.length; ) {
    const q = lerQuantia(t, i)
    if (q) {
      // Número por extenso solto e pequeno ("um boleto", "dois") quase nunca é dinheiro.
      if (!(q.extenso && !q.forte && q.centavos < 1000)) candidatas.push(q)
      i = q.fim
    } else i++
  }
  const validas = candidatas.filter((q) => q.centavos > 0)
  return (
    validas.find((q) => q.forte) ?? validas.find((q) => !q.extenso) ?? validas[0] ?? null
  )
}

// ---------- favorecido ----------

const ARTIGOS = new Set(['o', 'a', 'os', 'as'])
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
const PARAM_NOME = new Set([
  'referente', 'ref', 'pelo', 'pela', 'por', 'sobre', 'que', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'pra',
  'dia', 'hoje', 'ontem', 'anteontem', 'ao', 'aos', 'como',
])
// Palavras comuns que seguem "de/para" mas não são pessoas ("recebi 800 reais de aluguel").
const NAO_NOMES = new Set([
  'aluguel', 'salario', 'venda', 'vendas', 'comissao', 'juros', 'rendimento', 'rendimentos', 'reembolso', 'freelance',
  'servico', 'servicos', 'mesada', 'pensao', 'lucro', 'dividendos', 'troco', 'gasolina', 'combustivel', 'luz', 'agua',
  'internet', 'telefone', 'gas', 'mercado', 'supermercado', 'farmacia', 'padaria', 'remedio', 'remedios', 'conta',
  'contas', 'boleto', 'parcela', 'prestacao', 'financiamento', 'imposto', 'compra', 'compras', 'almoco', 'jantar',
  'cafe', 'lanche', 'onibus', 'passagem', 'mim', 'voce', 'uma', 'um', 'ele', 'ela', 'isso', 'esse', 'essa',
])

/** "joão da silva" -> "João da Silva": inicial maiúscula em cada palavra, menos da/de/do/das/dos/e. */
export function capitalizarNome(palavras: string[]): string {
  return palavras
    .map((w) => {
      const baixa = w.toLocaleLowerCase('pt-BR')
      if (PARTICULAS.has(semAcento(w))) return baixa
      return baixa.charAt(0).toLocaleUpperCase('pt-BR') + baixa.slice(1)
    })
    .join(' ')
}

function lerNome(t: Tok[], inicio: number, pulaArtigo: boolean): string | null {
  let i = inicio
  if (pulaArtigo && livre(t, i) && ARTIGOS.has(t[i].l) && i + 1 < t.length) i++
  while (livre(t, i) && TRATAMENTOS.has(t[i].l)) i++
  const nome: string[] = []
  for (; i < t.length && nome.length < 4; i++) {
    const tk = t[i]
    if (tk.rem || tk.l === '' || /\d/.test(tk.l) || PARAM_NOME.has(tk.l)) break
    if (PARTICULAS.has(tk.l)) {
      const nx = t[i + 1]
      if (nome.length === 0 || !nx || nx.rem || PARAM_NOME.has(nx.l) || PARTICULAS.has(nx.l) || /\d/.test(nx.l)) break
    }
    nome.push(tk.orig.replace(PONTAS, '').replace(/^\$|\$$/g, ''))
    if (/[,.;!?]$/.test(tk.orig)) break
  }
  while (nome.length > 0 && PARTICULAS.has(semAcento(nome[nome.length - 1]))) nome.pop()
  if (nome.length === 0 || NAO_NOMES.has(semAcento(nome[0]))) return null
  return capitalizarNome(nome).slice(0, FAVORECIDO_MAX).trim()
}

// ---------- principal ----------

/**
 * Interpreta a frase reconhecida pela voz. Função pura: `hoje` é 'YYYY-MM-DD' e todas as datas
 * são calculadas por aritmética de string. Palavras-chave ignoram acento e maiúsculas; descrição e
 * favorecido preservam os acentos originais.
 */
export function interpretarFala(texto: string, hoje: string): FalaInterpretada {
  const t = tokenizar(texto)
  if (t.length === 0) return { ok: false, motivo: 'vazio' }

  // Comandos: o tipo sai deles; as palavras não entram na descrição.
  let entrada = false
  let fimComandoEntrada = -1
  for (let i = 0; i < t.length; i++) {
    const l = t[i].l
    if (COMANDOS_ENTRADA.has(l)) {
      entrada = true
      t[i].rem = true
      fimComandoEntrada = i + 1
    } else if (l === 'me' && t[i + 1]?.l === 'pagou') {
      entrada = true
      t[i].rem = t[i + 1].rem = true
      fimComandoEntrada = i + 2
    } else if (COMANDOS_SAIDA.has(l)) {
      t[i].rem = true
      // "pagamento do boleto" -> "boleto"
      if (l === 'pagamento' && t[i + 1] && DE_DO_DA.has(t[i + 1].l)) t[i + 1].rem = true
    }
  }

  const data = extrairData(t, hoje) ?? hoje

  const q = extrairValor(t)
  if (!q) return { ok: false, motivo: 'sem_valor' }
  for (let k = q.ini; k < q.fim; k++) t[k].rem = true
  for (let k = q.ini - 1; k >= 0 && !t[k].rem && PREPOSICOES_ANTES_DE_VALOR.has(t[k].l); k--) t[k].rem = true

  let favorecido: string | null = null
  if (entrada) {
    // "recebi 350 reais do João" / "recebi do João 350 reais".
    for (const p of [q.fim, fimComandoEntrada]) {
      if (p < 0 || !livre(t, p) || !DE_DO_DA.has(t[p].l)) continue
      favorecido = lerNome(t, p + 1, false)
      if (favorecido) break
    }
  } else {
    for (let i = 0; i < t.length && !favorecido; i++) {
      if (!t[i].rem && (t[i].l === 'para' || t[i].l === 'pra')) favorecido = lerNome(t, i + 1, true)
    }
  }

  let descricao = t
    .filter((x) => !x.rem)
    .map((x) => x.orig)
    .join(' ')
    .replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, '')
    .replace(/\s+/g, ' ')
  descricao = descricao === '' ? DESCRICAO_PADRAO : descricao.charAt(0).toLocaleUpperCase('pt-BR') + descricao.slice(1)
  descricao = descricao.slice(0, DESCRICAO_MAX).trimEnd()

  return {
    ok: true,
    valorCentavos: entrada ? q.centavos : -q.centavos,
    descricao,
    data,
    ...(favorecido ? { favorecido } : {}),
  }
}
