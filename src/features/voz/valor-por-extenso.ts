const UNIDADES = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
]
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos',
  'novecentos',
]

/** 1..999 por extenso. */
function ate999(n: number): string {
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto < 20) partes.push(UNIDADES[resto])
    else {
      partes.push(DEZENAS[Math.floor(resto / 10)])
      if (resto % 10 > 0) partes.push(UNIDADES[resto % 10])
    }
  }
  return partes.join(' e ')
}

/** Une um bloco ao resto: "e" quando o resto é menor que 100 ou centena exata ("mil e duzentos"), senão espaço. */
function juntar(prefixo: string, resto: number): string {
  if (resto === 0) return prefixo
  const sep = resto < 100 || resto % 100 === 0 ? ' e ' : ' '
  return prefixo + sep + inteiroPorExtenso(resto)
}

/** Inteiro >= 0 até 999.999.999 por extenso. */
function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  if (n < 1000) return ate999(n)
  if (n < 1_000_000) {
    const mil = Math.floor(n / 1000)
    const prefixo = mil === 1 ? 'mil' : `${ate999(mil)} mil`
    return juntar(prefixo, n % 1000)
  }
  const mi = Math.floor(n / 1_000_000)
  const prefixo = mi === 1 ? 'um milhão' : `${ate999(mi)} milhões`
  return juntar(prefixo, n % 1_000_000)
}

/**
 * Valor monetário por extenso, para a fala de confirmação: 20000 -> "duzentos reais",
 * 150050 -> "mil e quinhentos reais e cinquenta centavos". O sinal é ignorado.
 */
export function valorPorExtenso(centavos: number): string {
  const abs = Math.abs(Math.round(centavos))
  const reais = Math.floor(abs / 100)
  const cents = abs % 100
  const textoReais = (): string => {
    const base = inteiroPorExtenso(reais)
    if (reais === 1) return `${base} real`
    // "um milhão de reais", "dois milhões de reais"
    return reais >= 1_000_000 && reais % 1_000_000 === 0 ? `${base} de reais` : `${base} reais`
  }
  const textoCents = (): string => `${inteiroPorExtenso(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`
  if (reais === 0 && cents === 0) return 'zero reais'
  if (cents === 0) return textoReais()
  if (reais === 0) return textoCents()
  return `${textoReais()} e ${textoCents()}`
}
