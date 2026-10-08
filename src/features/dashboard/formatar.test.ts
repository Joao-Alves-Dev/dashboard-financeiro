import { describe, expect, it } from 'vitest'
import { formatarBRLCompacto, formatarPercentual, formatarVariacao, variacaoPercentual } from './formatar'

const norm = (s: string) => s.replace(/[\s  ]/g, ' ')

describe('variacaoPercentual', () => {
  it('nulo quando o anterior é zero', () => {
    expect(variacaoPercentual(1000, 0)).toBeNull()
    expect(variacaoPercentual(0, 0)).toBeNull()
  })
  it('calcula sobre o módulo do anterior', () => {
    expect(variacaoPercentual(150, 100)).toBe(50)
    expect(variacaoPercentual(50, 100)).toBe(-50)
    // resultado saiu de -100 para -50: melhorou 50%
    expect(variacaoPercentual(-50, -100)).toBe(50)
    expect(variacaoPercentual(100, -100)).toBe(200)
    // sem ruído de ponto flutuante
    expect(variacaoPercentual(3200, 1000)).toBe(220)
    expect(variacaoPercentual(1, 3)).toBe(-66.67)
  })
})

describe('formatarVariacao', () => {
  it('sinal explícito e vírgula decimal', () => {
    expect(norm(formatarVariacao(12.5))).toBe('+12,5%')
    expect(norm(formatarVariacao(-3))).toBe('-3%')
    expect(norm(formatarVariacao(0))).toBe('0%')
  })
  it('nulo vira travessão', () => {
    expect(formatarVariacao(null)).toBe('—')
  })
  it('arredonda a uma casa', () => {
    expect(norm(formatarVariacao(12.345))).toBe('+12,3%')
  })
})

describe('formatarPercentual', () => {
  it('inteiro sem sinal', () => {
    expect(norm(formatarPercentual(85.4))).toBe('85%')
    expect(norm(formatarPercentual(120))).toBe('120%')
  })
})

describe('formatarBRLCompacto', () => {
  it('compacta milhar e milhão', () => {
    expect(norm(formatarBRLCompacto(150000))).toMatch(/^R\$ 1,5 mil$/)
    expect(norm(formatarBRLCompacto(0))).toBe('R$ 0')
    expect(norm(formatarBRLCompacto(250000000))).toMatch(/^R\$ 2,5 mi/)
    expect(norm(formatarBRLCompacto(-150000))).toMatch(/^-R\$ 1,5 mil$/)
  })
})
