import { parseValorBR } from '@/lib/money'
import { montarDataIso } from './datas'
import type { ErroLinha, LinhaImportada, ResultadoParse } from './tipos'

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16))
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10))
    return ENTIDADES[k] ?? m
  })
}

/** Valor da tag até o próximo `<` ou fim de linha (cobre SGML 1.x e XML 2.x). */
function tag(bloco: string, nome: string): string | undefined {
  const m = new RegExp(`<${nome}>([^<\r\n]*)`, 'i').exec(bloco)
  return m ? decodificarEntidades(m[1]).trim() : undefined
}

/**
 * TRNAMT -> centavos. Padrão OFX é ponto decimal, mas exportadores BR usam vírgula.
 * - ponto e vírgula juntos: o último separador é o decimal, o outro é milhar;
 * - só vírgula: 1 vírgula com 1-2 dígitos depois é decimal; senão milhar;
 * - só ponto: 1 ponto é decimal; vários pontos são milhar;
 * - mais de 2 casas decimais só se as extras forem zeros ("12.500" -> 12,50).
 */
function valorOfx(bruto: string): number | null {
  let t = bruto.replace(/\s/g, '')
  let sinal = ''
  if (t.startsWith('-')) {
    sinal = '-'
    t = t.slice(1)
  } else if (t.startsWith('+')) {
    t = t.slice(1)
  }
  if (!/^[\d.,]+$/.test(t)) return null

  const ultPonto = t.lastIndexOf('.')
  const ultVirg = t.lastIndexOf(',')
  const nPonto = t.split('.').length - 1
  const nVirg = t.split(',').length - 1
  let idxDec = -1
  if (ultPonto >= 0 && ultVirg >= 0) idxDec = Math.max(ultPonto, ultVirg)
  else if (ultVirg >= 0) idxDec = nVirg === 1 && t.length - ultVirg - 1 !== 3 ? ultVirg : -1
  else if (ultPonto >= 0) idxDec = nPonto === 1 ? ultPonto : -1

  const parteInt = (idxDec >= 0 ? t.slice(0, idxDec) : t).replace(/[.,]/g, '')
  let frac = idxDec >= 0 ? t.slice(idxDec + 1) : ''
  if (!/^\d*$/.test(parteInt) || !/^\d*$/.test(frac)) return null
  // separadores de milhar só são válidos antes do decimal
  if (idxDec >= 0 && /[.,]/.test(frac)) return null
  frac = frac.replace(/0+$/, '')
  if (frac.length > 2) return null
  const canon = `${sinal}${parteInt || '0'}${frac ? `.${frac}` : ''}`
  return parseValorBR(canon)
}

function dataOfx(bruto: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(bruto)
  // só a data escrita no arquivo: hora e fuso ([-3:BRT]) são ignorados, sem conversão
  return m ? montarDataIso(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

export function parseOfx(texto: string): ResultadoParse {
  const linhas: LinhaImportada[] = []
  const erros: ErroLinha[] = []
  const re = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|<\/CCSTMTRS>|$)/gi

  let ordinal = 0
  for (const m of texto.matchAll(re)) {
    // `linha` = posição da transação no arquivo (1-based); OFX costuma vir numa linha só
    const linha = ++ordinal
    const bloco = m[1]

    const data = dataOfx(tag(bloco, 'DTPOSTED') ?? '')
    if (data === null) {
      erros.push({ linha, motivo: 'data inválida' })
      continue
    }
    const valorCentavos = valorOfx(tag(bloco, 'TRNAMT') ?? '')
    if (valorCentavos === null) {
      erros.push({ linha, motivo: 'valor inválido' })
      continue
    }
    const descricao = tag(bloco, 'MEMO') || tag(bloco, 'NAME') || ''
    if (descricao === '') {
      erros.push({ linha, motivo: 'descrição vazia' })
      continue
    }
    const item: LinhaImportada = { linha, data, descricao, valorCentavos }
    const fitid = tag(bloco, 'FITID')
    if (fitid) item.idExterno = fitid
    linhas.push(item)
  }
  return { linhas, erros }
}
