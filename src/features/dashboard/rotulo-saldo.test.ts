import { describe, expect, it } from 'vitest'
import mensagens from '../../../messages/pt-BR.json'
import { chaveRotuloSaldo } from './rotulo-saldo'

describe('chaveRotuloSaldo', () => {
  it('sem saldo inicial em nenhuma conta: resultado acumulado', () => {
    expect(chaveRotuloSaldo([])).toBe('resultadoAcumulado')
    expect(chaveRotuloSaldo([{ saldoInicialCentavos: 0 }])).toBe('resultadoAcumulado')
    expect(chaveRotuloSaldo([{ saldoInicialCentavos: 0 }, { saldoInicialCentavos: 0 }])).toBe('resultadoAcumulado')
  })
  it('alguma conta com saldo inicial (inclusive negativo): saldo atual', () => {
    expect(chaveRotuloSaldo([{ saldoInicialCentavos: 0 }, { saldoInicialCentavos: 150000 }])).toBe('saldoAtual')
    expect(chaveRotuloSaldo([{ saldoInicialCentavos: -2000 }])).toBe('saldoAtual')
  })
  it('os textos existem em pt-BR.json', () => {
    const k = mensagens.dashboard.kpis
    expect(k.saldoAtual).toBe('Saldo atual')
    expect(k.resultadoAcumulado).toBe('Resultado acumulado')
    expect(k.resultadoAcumuladoAjuda.length).toBeGreaterThan(10)
  })
})
