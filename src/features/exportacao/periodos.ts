import { inicioDoMes, mesAnterior, ultimoDiaDoMes } from '@/features/dashboard/periodo'
import { montarDataIso } from '@/features/importacao/datas'
import { diaDaSemana, diaMesParaData, numeroDoMes, somarDias } from '@/features/voz/datas-fala'
import { extensoParaNumero, semAcento } from '@/features/voz/numeros-extenso'

/** Palavra já normalizada (minúsculas, sem acento, sem pontuação nas pontas). */
type P = { l: string }

export type PeriodoNosTokens = { de: string; ate: string; ini: number; fim: number }

/** Palavras que, logo antes de um período, fazem parte dele ("de", "desde o dia", "no mês", "entre"). */
const ANTES_DO_PERIODO = new Set([
  'de', 'do', 'da', 'no', 'na', 'em', 'desde', 'entre', 'o', 'a', 'dia', 'mes', 'este', 'deste', 'neste', 'esse', 'desse',
  'nesse', 'esta', 'desta', 'nesta', 'essa', 'dessa', 'nessa', 'nos', 'nas', 'dos',
])
const LIGACAO = new Set(['ate', 'a', 'ao', '-', '–'])

type Data = { dia: number | null; mes: number | null; ano: number | null; relativa: string | null; ini: number; fim: number }

const PONTAS = /^[^\p{L}\p{N}$/-]+|[^\p{L}\p{N}$/-]+$/gu

/** Divide o texto em palavras normalizadas (a mesma normalização do interpretador de fala). */
export function palavrasDoPeriodo(texto: string): P[] {
  return (texto.normalize('NFC').match(/\S+/g) ?? []).map((orig) => ({ l: semAcento(orig).replace(PONTAS, '') }))
}

function ehAnoDe4(s: string | undefined): boolean {
  return /^\d{4}$/.test(s ?? '')
}

/** Lê uma data a partir de `i`: hoje/ontem/anteontem, dd/mm[/aaaa], "[dia] N [de <mês> [de <ano>]]". */
function lerData(t: P[], i: number, hoje: string): Data | null {
  const l0 = t[i]?.l
  if (l0 === undefined) return null
  if (l0 === 'hoje' || l0 === 'ontem' || l0 === 'anteontem') {
    const iso = l0 === 'hoje' ? hoje : somarDias(hoje, l0 === 'ontem' ? -1 : -2)
    return { dia: null, mes: null, ano: null, relativa: iso, ini: i, fim: i + 1 }
  }
  let j = i
  let comDia = false
  if (l0 === 'dia') {
    comDia = true
    j = i + 1
  }
  const s = t[j]?.l
  if (s === undefined) return null
  const num = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(s)
  if (num) {
    const ano = num[3] === undefined ? null : num[3].length === 2 ? 2000 + Number(num[3]) : Number(num[3])
    return { dia: Number(num[1]), mes: Number(num[2]), ano, relativa: null, ini: i, fim: j + 1 }
  }
  let dia: number
  if (/^\d{1,2}[ºo°]?$/.test(s)) dia = parseInt(s, 10)
  else if (s === 'primeiro' && t[j + 1]?.l === 'de' && numeroDoMes(t[j + 2]?.l ?? '') !== null) dia = 1
  else return null
  let fim = j + 1
  let mes: number | null = null
  let ano: number | null = null
  if (t[fim]?.l === 'de') {
    const m = numeroDoMes(t[fim + 1]?.l ?? '')
    if (m !== null) {
      mes = m
      fim += 2
      if (t[fim]?.l === 'de' && ehAnoDe4(t[fim + 1]?.l)) {
        ano = Number(t[fim + 1].l)
        fim += 2
      }
    }
  }
  return { dia, mes, ano, relativa: null, ini: i, fim: mes === null && !comDia ? j + 1 : fim }
}

function resolverData(d: Data, hoje: string, ano?: number | null): string | null {
  if (d.relativa) return d.relativa
  return diaMesParaData(d.dia as number, d.mes, d.ano ?? ano ?? null, hoje)
}

function estenderParaTras(t: P[], ini: number): number {
  let i = ini
  while (i > 0 && ANTES_DO_PERIODO.has(t[i - 1].l)) i--
  return i
}

function ordenar(de: string, ate: string): { de: string; ate: string } {
  return de <= ate ? { de, ate } : { de: ate, ate: de }
}

const INVALIDO = Symbol('invalido')

/** Intervalo "de A até B" ou data única; `INVALIDO` quando a data está bem escrita mas não existe (31/09). */
function lerDatas(t: P[], hoje: string): PeriodoNosTokens | typeof INVALIDO | null {
  for (let i = 0; i < t.length; i++) {
    const a = lerData(t, i, hoje)
    if (!a) continue
    // Ligação com a segunda data: "até", "a", "ao" ou "e" depois de "entre".
    let j = a.fim
    const ligacao = t[j]?.l
    const ehLigacao = ligacao !== undefined && (LIGACAO.has(ligacao) || (ligacao === 'e' && t[i - 1]?.l === 'entre'))
    let b: Data | null = null
    if (ehLigacao) {
      j++
      if (t[j]?.l === 'o' && t[j + 1]?.l === 'dia') j++
      if (t[j]?.l === 'o' && t[j + 1] && lerData(t, j + 1, hoje)) j++
      b = lerData(t, j, hoje)
    }

    // Dia solto ("1") só vale dentro de um intervalo cuja segunda data tem mês.
    const aSolto = a.relativa === null && a.mes === null && t[i].l !== 'dia'
    if (aSolto && !(b && (b.mes !== null))) continue

    if (b) {
      const mes = a.mes ?? b.mes
      const ano = a.ano ?? b.ano
      const dA: Data = { ...a, mes, ano }
      const dB: Data = { ...b, ano: b.ano ?? a.ano }
      const isoB = resolverData(dB, hoje)
      let isoA = resolverData(dA, hoje)
      // "25 de dezembro a 5 de janeiro de 2026": A fica no ano anterior ao de B.
      if (a.ano === null && b.ano !== null && a.mes !== null && isoB && isoA && isoA > isoB) {
        isoA = resolverData(dA, hoje, b.ano - 1)
      }
      if (!isoA || !isoB) return INVALIDO
      return { ...ordenar(isoA, isoB), ini: estenderParaTras(t, i), fim: b.fim }
    }
    if (aSolto) continue
    const iso = resolverData(a, hoje)
    if (!iso) return INVALIDO
    return { de: iso, ate: iso, ini: estenderParaTras(t, i), fim: a.fim }
  }
  return null
}

function lerPalavrasChave(t: P[], hoje: string): PeriodoNosTokens | null {
  for (let i = 0; i < t.length; i++) {
    const l = t[i].l
    if (l === 'mes') {
      if (t[i + 1]?.l === 'de' && numeroDoMes(t[i + 2]?.l ?? '') !== null) continue // "mês de outubro": mês pelo nome
      if (t[i + 1]?.l === 'passado' || t[i + 1]?.l === 'anterior') {
        const ini = mesAnterior(hoje)
        return { de: ini, ate: ultimoDiaDoMes(ini), ini: estenderParaTras(t, i), fim: i + 2 }
      }
      return { de: inicioDoMes(hoje), ate: hoje, ini: estenderParaTras(t, i), fim: i + 1 }
    }
    if (l === 'semana') {
      const dow = diaDaSemana(hoje)
      const segundaDestaSemana = somarDias(hoje, -((dow + 6) % 7))
      if (t[i + 1]?.l === 'passada' || t[i + 1]?.l === 'anterior') {
        return {
          de: somarDias(segundaDestaSemana, -7),
          ate: somarDias(segundaDestaSemana, -1),
          ini: estenderParaTras(t, i),
          fim: i + 2,
        }
      }
      return { de: segundaDestaSemana, ate: hoje, ini: estenderParaTras(t, i), fim: i + 1 }
    }
    if (l === 'ultimos' || l === 'ultimas') {
      // "últimos 15 dias" / "últimos quinze dias" / "últimos vinte e cinco dias"
      for (let k = i + 2; k <= Math.min(i + 5, t.length - 1); k++) {
        if (t[k].l !== 'dias') continue
        const palavras = t.slice(i + 1, k).map((p) => p.l)
        const n = palavras.length === 1 && /^\d+$/.test(palavras[0]) ? Number(palavras[0]) : extensoParaNumero(palavras.join(' '))
        if (n !== null && n >= 1 && n <= 3660) {
          return { de: somarDias(hoje, -n), ate: hoje, ini: estenderParaTras(t, i), fim: k + 1 }
        }
        break
      }
    }
  }
  return null
}

function lerMesPeloNome(t: P[], hoje: string): PeriodoNosTokens | null {
  const [ah, mh] = hoje.split('-').map(Number)
  for (let i = 0; i < t.length; i++) {
    const mes = numeroDoMes(t[i].l)
    if (mes === null) continue
    let fim = i + 1
    let ano: number | null = null
    if (t[fim]?.l === 'de' && ehAnoDe4(t[fim + 1]?.l)) {
      ano = Number(t[fim + 1].l)
      fim += 2
    }
    const a = ano ?? (mes > mh ? ah - 1 : ah)
    const de = montarDataIso(a, mes, 1)
    if (!de) continue
    const ultimo = ultimoDiaDoMes(de)
    // Mês em andamento: só até hoje.
    const ate = a === ah && mes === mh ? hoje : ultimo
    return { de, ate, ini: estenderParaTras(t, i), fim }
  }
  return null
}

/**
 * Procura o período dentro das palavras (e onde ele está, para quem quiser tirá-lo da frase).
 * Ordem: datas e intervalos explícitos, depois expressões ("mês passado", "últimos N dias",
 * "semana passada"…) e por fim o mês pelo nome. Data escrita direito mas inexistente → null.
 */
export function periodoNosTokens(t: P[], hoje: string): PeriodoNosTokens | null {
  const datas = lerDatas(t, hoje)
  if (datas === INVALIDO) return null
  return datas ?? lerPalavrasChave(t, hoje) ?? lerMesPeloNome(t, hoje)
}

/**
 * Período citado em uma frase falada ou digitada, como `{ de, ate }` ('YYYY-MM-DD', inclusivos);
 * `null` se não houver. Datas por aritmética de string; ano omitido = ano de `hoje` e, se a data
 * ficar no futuro, o ano anterior. Intervalo invertido é corrigido; mês em andamento vai até `hoje`.
 */
export function resolverPeriodo(texto: string, hoje: string): { de: string; ate: string } | null {
  const r = periodoNosTokens(palavrasDoPeriodo(texto), hoje)
  return r ? { de: r.de, ate: r.ate } : null
}
