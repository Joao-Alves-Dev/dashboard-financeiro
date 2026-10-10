import { describe, expect, it } from 'vitest'
import { interpretarComando } from './interpretar-comando'

const HOJE = '2026-10-08'

describe('interpretarComando', () => {
  it('exportação com favorecido e intervalo', () => {
    expect(interpretarComando('exporte as transações para o senhor Jeová de 29 de setembro até 8 de outubro', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jeová',
      de: '2026-09-29',
      ate: '2026-10-08',
      filtroTipo: 'saidas',
    })
  })

  it('"de 29 de setembro" é período e "de João" é favorecido', () => {
    expect(interpretarComando('exporta a lista de João de 29 de setembro até 8 de outubro', HOJE)).toMatchObject({
      tipo: 'exportar',
      favorecido: 'João',
      de: '2026-09-29',
      ate: '2026-10-08',
    })
    // O mesmo texto com o período antes do nome.
    expect(interpretarComando('exporte de 29 de setembro até 8 de outubro as transações do João', HOJE)).toMatchObject({
      favorecido: 'João',
      de: '2026-09-29',
    })
    // "de" + número sem mês, dentro de intervalo.
    expect(interpretarComando('exporte para a Maria de 1 a 8 de outubro', HOJE)).toMatchObject({
      favorecido: 'Maria',
      de: '2026-10-01',
      ate: '2026-10-08',
    })
  })

  it('"manda a lista do Jeová deste mês"', () => {
    expect(interpretarComando('manda a lista do Jeová deste mês', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jeová',
      de: '2026-10-01',
      ate: '2026-10-08',
      filtroTipo: 'saidas',
    })
  })

  it('"exportar o que recebi do João no mês passado" vira entradas', () => {
    expect(interpretarComando('exportar o que recebi do João no mês passado', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'João',
      de: '2026-09-01',
      ate: '2026-09-30',
      filtroTipo: 'entradas',
    })
  })

  it('sem favorecido: todos (e "tudo" = todas as transações)', () => {
    expect(interpretarComando('exporte tudo do mês passado', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: '',
      de: '2026-09-01',
      ate: '2026-09-30',
      filtroTipo: 'todas',
    })
    expect(interpretarComando('exportar transações de outubro', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: '',
      de: '2026-10-01',
      ate: '2026-10-08',
      filtroTipo: 'saidas',
    })
  })

  it('falta o período: pergunta, mantendo o que já entendeu', () => {
    expect(interpretarComando('exporte para Jeová', HOJE)).toEqual({
      tipo: 'exportar_incompleto',
      falta: 'periodo',
      favorecido: 'Jeová',
      filtroTipo: 'saidas',
    })
    expect(interpretarComando('exporte', HOJE)).toMatchObject({ tipo: 'exportar_incompleto', favorecido: '' })
  })

  it('bordas da fala real', () => {
    expect(interpretarComando('exporta a lista do seu jeová de ontem até hoje', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jeová',
      de: '2026-10-07',
      ate: '2026-10-08',
      filtroTipo: 'saidas',
    })
    expect(interpretarComando('me manda o relatório do jeová deste mês', HOJE)).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Jeová',
      de: '2026-10-01',
    })
    expect(interpretarComando('gerar lista de pagamentos para a dona maria josé dos últimos 30 dias', HOJE)).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Maria José',
      de: '2026-09-08',
      ate: '2026-10-08',
    })
    expect(interpretarComando('exporte as transações da semana passada para o Pedro', HOJE)).toMatchObject({
      favorecido: 'Pedro',
      de: '2026-09-28',
      ate: '2026-10-04',
    })
    expect(interpretarComando('exporte o extrato do joão da silva de 29/09 até 08/10', HOJE)).toMatchObject({
      favorecido: 'João da Silva',
      de: '2026-09-29',
      filtroTipo: 'todas',
    })
  })

  it('sem verbo de exportação é lançamento (decisão: a ambiguidade cai no lançamento)', () => {
    expect(interpretarComando('200 reais para o senhor Jeová', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('paguei 100 reais para o senhor Jeová dia 29 de setembro', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('Jeová de 29 de setembro até 8 de outubro', HOJE)).toEqual({ tipo: 'lancamento' })
  })
})
