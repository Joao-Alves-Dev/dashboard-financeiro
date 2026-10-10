/** Minúsculas e sem acento: "Três" -> "tres". */
export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
}
const DEZ_A_DEZENOVE: Record<string, number> = {
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
}
const DEZENAS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
}
const CENTENAS: Record<string, number> = {
  cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}

/** Palavra (já sem acento/minúscula) que faz parte de um número por extenso; "e" não conta. */
function palavraNumerica(p: string): boolean {
  return (
    p in UNIDADES ||
    p in DEZ_A_DEZENOVE ||
    p in DEZENAS ||
    p in CENTENAS ||
    p === 'cem' ||
    p === 'mil' ||
    p === 'milhao' ||
    p === 'milhoes'
  )
}

export function ehPalavraNumerica(palavra: string): boolean {
  return palavraNumerica(semAcento(palavra))
}

/**
 * "cinco mil e quinhentos" -> 5500. Gramática estrita (centenas, dezenas, unidades, nesta ordem em cada
 * grupo de três dígitos; milhões antes de milhares) para que "dois três" ou "cem cem" não somem por acidente.
 * O "e" é opcional entre as palavras, mas não pode abrir nem fechar a expressão. Vai até milhões.
 */
export function extensoParaNumero(palavras: string): number | null {
  const ps = semAcento(palavras).split(/\s+/).filter(Boolean)
  if (ps.length === 0 || ps[0] === 'e' || ps[ps.length - 1] === 'e') return null

  let total = 0
  let grupo = 0
  // 0 vazio, 1 após centena, 2 após dezena (20-90), 3 grupo fechado (unidade, 10-19 ou "cem")
  let estado = 0
  // maior escala já usada: 0 nenhuma, 2 milhão, 1 mil (só pode descer)
  let escala = 3
  let algo = false

  for (const p of ps) {
    if (p === 'e') continue
    if (p === 'cem') {
      if (estado !== 0) return null
      grupo += 100
      estado = 3
    } else if (p in CENTENAS) {
      if (estado !== 0) return null
      grupo += CENTENAS[p]
      estado = 1
    } else if (p in DEZENAS) {
      if (estado > 1) return null
      grupo += DEZENAS[p]
      estado = 2
    } else if (p in DEZ_A_DEZENOVE) {
      if (estado > 1) return null
      grupo += DEZ_A_DEZENOVE[p]
      estado = 3
    } else if (p in UNIDADES) {
      if (estado > 2) return null
      grupo += UNIDADES[p]
      estado = 3
    } else if (p === 'mil') {
      if (escala <= 1) return null
      total += (grupo || 1) * 1000
      grupo = 0
      estado = 0
      escala = 1
    } else if (p === 'milhao' || p === 'milhoes') {
      if (escala <= 2 || grupo === 0 || (p === 'milhao' && grupo !== 1) || (p === 'milhoes' && grupo < 2)) return null
      total += grupo * 1_000_000
      grupo = 0
      estado = 0
      escala = 2
    } else {
      return null
    }
    algo = true
  }
  return algo ? total + grupo : null
}
