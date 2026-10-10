import { describe, expect, it } from 'vitest'
import { resolverPeriodo } from './periodos'

const HOJE = '2026-10-08' // quinta-feira

describe('resolverPeriodo', () => {
  it.each([
    ['este mês', { de: '2026-10-01', ate: '2026-10-08' }],
    ['deste mês', { de: '2026-10-01', ate: '2026-10-08' }],
    ['no mês', { de: '2026-10-01', ate: '2026-10-08' }],
    ['mês passado', { de: '2026-09-01', ate: '2026-09-30' }],
    ['do mes passado', { de: '2026-09-01', ate: '2026-09-30' }],
    ['últimos 15 dias', { de: '2026-09-23', ate: '2026-10-08' }],
    ['nos últimos trinta dias', { de: '2026-09-08', ate: '2026-10-08' }],
    ['semana passada', { de: '2026-09-28', ate: '2026-10-04' }],
    ['esta semana', { de: '2026-10-05', ate: '2026-10-08' }],
    ['ontem', { de: '2026-10-07', ate: '2026-10-07' }],
    ['hoje', { de: '2026-10-08', ate: '2026-10-08' }],
  ])('%s', (texto, esperado) => {
    expect(resolverPeriodo(texto, HOJE)).toEqual(esperado)
  })

  it.each([
    ['de 29 de setembro até 8 de outubro', { de: '2026-09-29', ate: '2026-10-08' }],
    ['de 29 de setembro a 8 de outubro', { de: '2026-09-29', ate: '2026-10-08' }],
    ['de 1 a 8 de outubro', { de: '2026-10-01', ate: '2026-10-08' }],
    ['de 8 a 1 de outubro', { de: '2026-10-01', ate: '2026-10-08' }],
    ['entre 1 e 8 de outubro', { de: '2026-10-01', ate: '2026-10-08' }],
    ['de ontem até hoje', { de: '2026-10-07', ate: '2026-10-08' }],
    ['desde o dia 29 de setembro até hoje', { de: '2026-09-29', ate: '2026-10-08' }],
    ['de 29/09 até 08/10', { de: '2026-09-29', ate: '2026-10-08' }],
    ['de 29/09/2025 a 08/10/2025', { de: '2025-09-29', ate: '2025-10-08' }],
    ['de 3 de março de 2025 até 5 de abril de 2025', { de: '2025-03-03', ate: '2025-04-05' }],
    ['dia 29 de setembro', { de: '2026-09-29', ate: '2026-09-29' }],
  ])('intervalo: %s', (texto, esperado) => {
    expect(resolverPeriodo(texto, HOJE)).toEqual(esperado)
  })

  it('virada de ano sem ano: data futura vai para o ano anterior', () => {
    expect(resolverPeriodo('de 25 de dezembro a 5 de janeiro', '2026-01-10')).toEqual({
      de: '2025-12-25',
      ate: '2026-01-05',
    })
    expect(resolverPeriodo('de 10 de dezembro a 20 de dezembro', HOJE)).toEqual({
      de: '2025-12-10',
      ate: '2025-12-20',
    })
  })

  it('mês pelo nome: mês atual vai até hoje; mês passado inteiro; mês futuro = ano anterior', () => {
    expect(resolverPeriodo('transações de outubro', HOJE)).toEqual({ de: '2026-10-01', ate: '2026-10-08' })
    expect(resolverPeriodo('no mês de setembro', HOJE)).toEqual({ de: '2026-09-01', ate: '2026-09-30' })
    expect(resolverPeriodo('fevereiro', HOJE)).toEqual({ de: '2026-02-01', ate: '2026-02-28' })
    expect(resolverPeriodo('dezembro', HOJE)).toEqual({ de: '2025-12-01', ate: '2025-12-31' })
    expect(resolverPeriodo('fevereiro de 2024', HOJE)).toEqual({ de: '2024-02-01', ate: '2024-02-29' })
    expect(resolverPeriodo('março', HOJE)).toEqual({ de: '2026-03-01', ate: '2026-03-31' })
  })

  it('sem período: null', () => {
    expect(resolverPeriodo('', HOJE)).toBeNull()
    expect(resolverPeriodo('exporte para Jeová', HOJE)).toBeNull()
    expect(resolverPeriodo('200 reais para o senhor Jeová', HOJE)).toBeNull()
  })

  it('data inexistente é ignorada', () => {
    expect(resolverPeriodo('de 31 de setembro até 5 de outubro', HOJE)).toBeNull()
  })
})
