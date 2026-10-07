import { describe, expect, it } from 'vitest'
import { centavosParaCampo, formatarDataBR } from './formato'
import { parseValorBR } from './money'

describe('formato', () => {
  it('formatarDataBR inverte sem usar Date', () => {
    expect(formatarDataBR('2026-12-31')).toBe('31/12/2026')
    expect(formatarDataBR('2027-01-01')).toBe('01/01/2027')
    expect(formatarDataBR('x')).toBe('x')
  })
  it('centavosParaCampo é inverso de parseValorBR', () => {
    for (const c of [0, 5, 100, 123456, -123456, 99, 100000000]) {
      expect(parseValorBR(centavosParaCampo(c))).toBe(c)
    }
    expect(centavosParaCampo(123456)).toBe('1234,56')
    expect(centavosParaCampo(-5)).toBe('-0,05')
  })
})
