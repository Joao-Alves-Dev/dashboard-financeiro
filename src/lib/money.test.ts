import { describe, it, expect } from 'vitest'
import { parseValorBR, formatarBRL } from './money'

describe('parseValorBR', () => {
  it('interpreta vírgula decimal com milhar', () => {
    expect(parseValorBR('1.234,56')).toBe(123456)
    expect(parseValorBR('-1.234,56')).toBe(-123456)
  })
  it('aceita prefixo R$ e parênteses como negativo', () => {
    expect(parseValorBR('R$ 10,00')).toBe(1000)
    expect(parseValorBR('(10,00)')).toBe(-1000)
  })
  it('sem vírgula: ponto com 1-2 dígitos finais é decimal, senão milhar', () => {
    expect(parseValorBR('1234.56')).toBe(123456)
    expect(parseValorBR('1.234')).toBe(123400)
  })
  it('retorna null para entrada inválida', () => {
    expect(parseValorBR('abc')).toBeNull()
    expect(parseValorBR('')).toBeNull()
  })
  it('casos extras', () => {
    expect(parseValorBR('0,5')).toBe(50)
    expect(parseValorBR('R$ 1.234,56')).toBe(123456)
    expect(parseValorBR('1234')).toBe(123400)
    expect(parseValorBR('-1234.5')).toBe(-123450)
    expect(parseValorBR('1,234.56')).toBeNull()
    expect(parseValorBR('19.99')).toBe(1999)
    expect(parseValorBR('0,29')).toBe(29)
  })
})

describe('formatarBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatarBRL(-123456).replace(/\s/g, ' ')).toBe('-R$ 1.234,56')
    expect(formatarBRL(1000).replace(/\s/g, ' ')).toBe('R$ 10,00')
  })
})
