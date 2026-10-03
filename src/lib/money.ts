/**
 * Converte texto monetário brasileiro (ou ponto-decimal) em centavos inteiros.
 * Conversão por string: nunca multiplica float.
 * Regra: com vírgula, ela é decimal e pontos são milhar; sem vírgula, ponto
 * seguido de 1-2 dígitos finais é decimal, senão é milhar.
 */
export function parseValorBR(s: string): number | null {
  let t = s.trim()
  if (t === '') return null

  let negativo = false
  if (/^\(.*\)$/.test(t)) {
    negativo = true
    t = t.slice(1, -1).trim()
  }
  t = t.replace(/R\$/gi, '').replace(/\s/g, '')
  if (t.startsWith('-')) {
    negativo = !negativo
    t = t.slice(1)
  } else if (t.startsWith('+')) {
    t = t.slice(1)
  }
  if (t === '') return null

  let inteiro: string
  let decimal: string

  if (t.includes(',')) {
    const partes = t.split(',')
    if (partes.length !== 2) return null
    const [i, d] = partes
    if (!/^\d{1,3}(\.\d{3})*$|^\d*$/.test(i)) return null
    if (!/^\d{0,2}$/.test(d)) return null
    inteiro = i.replace(/\./g, '')
    decimal = d
  } else if (t.includes('.')) {
    const m = /^(\d+)\.(\d{1,2})$/.exec(t)
    if (m) {
      inteiro = m[1]
      decimal = m[2]
    } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
      inteiro = t.replace(/\./g, '')
      decimal = ''
    } else {
      return null
    }
  } else {
    if (!/^\d+$/.test(t)) return null
    inteiro = t
    decimal = ''
  }

  if (inteiro === '' && decimal === '') return null
  const centavos = Number(`${inteiro || '0'}${decimal.padEnd(2, '0')}`)
  if (!Number.isSafeInteger(centavos)) return null
  return negativo ? -centavos : centavos
}

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatarBRL(centavos: number): string {
  return formatadorBRL.format(centavos / 100)
}
