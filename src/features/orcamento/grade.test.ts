import { describe, expect, it } from 'vitest'
import {
  calcularTotais,
  formatarValorInput,
  interpretarValorOrcamento,
  lerMesInicial,
  mesesConsecutivos,
  normalizarMes,
  situacaoCelula,
  type LinhaGrade,
} from './grade'

describe('normalizarMes', () => {
  it('leva qualquer data do mês ao dia 1', () => {
    expect(normalizarMes('2026-10-17')).toBe('2026-10-01')
    expect(normalizarMes('2026-12-31')).toBe('2026-12-01')
    expect(normalizarMes('2027-01-01')).toBe('2027-01-01')
  })
  it('aceita YYYY-MM', () => {
    expect(normalizarMes('2026-03')).toBe('2026-03-01')
  })
  it('rejeita datas e formatos inválidos', () => {
    expect(normalizarMes('2026-13-01')).toBeNull()
    expect(normalizarMes('2026-02-30')).toBeNull()
    expect(normalizarMes('2026-00')).toBeNull()
    expect(normalizarMes('15/03/2026')).toBeNull()
    expect(normalizarMes('')).toBeNull()
    expect(normalizarMes('1500-01-01')).toBeNull()
  })
  it('29/02 só em ano bissexto', () => {
    expect(normalizarMes('2028-02-29')).toBe('2028-02-01')
    expect(normalizarMes('2027-02-29')).toBeNull()
  })
})

describe('mesesConsecutivos', () => {
  it('gera N meses atravessando o ano', () => {
    expect(mesesConsecutivos('2026-11-01', 4)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
  })
  it('normaliza o início', () => {
    expect(mesesConsecutivos('2026-10-20', 2)).toEqual(['2026-10-01', '2026-11-01'])
  })
})

describe('lerMesInicial', () => {
  it('usa o parâmetro válido, senão o mês de hoje', () => {
    expect(lerMesInicial('2026-05-10', '2026-10-08')).toBe('2026-05-01')
    expect(lerMesInicial(undefined, '2026-10-08')).toBe('2026-10-01')
    expect(lerMesInicial('lixo', '2026-10-08')).toBe('2026-10-01')
    expect(lerMesInicial(['2026-05-01', '2026-06-01'], '2026-10-08')).toBe('2026-10-01')
  })
})

describe('interpretarValorOrcamento', () => {
  it('vazio ou só espaços apaga', () => {
    expect(interpretarValorOrcamento('')).toEqual({ tipo: 'apagar' })
    expect(interpretarValorOrcamento('   ')).toEqual({ tipo: 'apagar' })
  })
  it('converte valores BR em centavos', () => {
    expect(interpretarValorOrcamento('1.234,56')).toEqual({ tipo: 'valor', centavos: 123456 })
    expect(interpretarValorOrcamento('R$ 800')).toEqual({ tipo: 'valor', centavos: 80000 })
  })
  it('zero é um orçamento válido de zero (não apaga)', () => {
    expect(interpretarValorOrcamento('0')).toEqual({ tipo: 'valor', centavos: 0 })
    expect(interpretarValorOrcamento('0,00')).toEqual({ tipo: 'valor', centavos: 0 })
  })
  it('rejeita negativo, inválido e absurdo', () => {
    expect(interpretarValorOrcamento('-10')).toEqual({ tipo: 'erro', motivo: 'negativo' })
    expect(interpretarValorOrcamento('(10,00)')).toEqual({ tipo: 'erro', motivo: 'negativo' })
    expect(interpretarValorOrcamento('abc')).toEqual({ tipo: 'erro', motivo: 'invalido' })
    expect(interpretarValorOrcamento('1.000.000.000,00')).toEqual({ tipo: 'erro', motivo: 'grande' })
  })
})

describe('formatarValorInput', () => {
  it('formata centavos como decimal pt-BR sem símbolo; nulo vira vazio', () => {
    expect(formatarValorInput(123456)).toBe('1.234,56')
    expect(formatarValorInput(80000)).toBe('800,00')
    expect(formatarValorInput(0)).toBe('0,00')
    expect(formatarValorInput(null)).toBe('')
  })
})

describe('situacaoCelula', () => {
  it('classifica orçado × realizado', () => {
    expect(situacaoCelula(null, 0)).toBe('sem_orcamento')
    expect(situacaoCelula(null, 500)).toBe('sem_orcamento')
    expect(situacaoCelula(1000, 1000)).toBe('dentro')
    expect(situacaoCelula(1000, 1001)).toBe('acima')
    expect(situacaoCelula(0, 0)).toBe('dentro')
    expect(situacaoCelula(0, 1)).toBe('acima')
  })
})

describe('calcularTotais', () => {
  const linhas: LinhaGrade[] = [
    { categoriaId: 'a', nome: 'A', cor: '#000', celulas: [{ mes: '2026-10-01', orcado: 1000, realizado: 400 }, { mes: '2026-11-01', orcado: null, realizado: 50 }] },
    { categoriaId: 'b', nome: 'B', cor: '#111', celulas: [{ mes: '2026-10-01', orcado: 0, realizado: 25 }, { mes: '2026-11-01', orcado: 300, realizado: 0 }] },
  ]
  it('soma orçado (nulo = 0) e realizado por mês', () => {
    expect(calcularTotais(linhas, ['2026-10-01', '2026-11-01'])).toEqual([
      { mes: '2026-10-01', orcado: 1000, realizado: 425 },
      { mes: '2026-11-01', orcado: 300, realizado: 50 },
    ])
  })
  it('sem linhas devolve zeros', () => {
    expect(calcularTotais([], ['2026-10-01'])).toEqual([{ mes: '2026-10-01', orcado: 0, realizado: 0 }])
  })
})
