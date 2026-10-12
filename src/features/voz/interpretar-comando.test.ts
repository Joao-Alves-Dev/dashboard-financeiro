import { describe, expect, it } from 'vitest'
import { PERIODO_TUDO } from '@/features/exportacao/periodos'
import { interpretarComando } from './interpretar-comando'

const HOJE = '2026-10-08'

describe('interpretarComando', () => {
  it('exportação com favorecido e intervalo', () => {
    expect(interpretarComando('exporte as transações para o senhor Jerônimo de 12 de março até 26 de março', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
      de: '2026-03-12',
      ate: '2026-03-26',
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

  it('"manda a lista do Jerônimo deste mês"', () => {
    expect(interpretarComando('manda a lista do Jerônimo deste mês', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
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

  it('sem período: exporta TUDO (todoPeriodo), mantendo o favorecido e o tipo', () => {
    // Task 15d: antes devolvia exportar_incompleto e o app perguntava "De que período?".
    expect(interpretarComando('exporte para Jerônimo', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
      ...PERIODO_TUDO,
      todoPeriodo: true,
      filtroTipo: 'saidas',
    })
    expect(interpretarComando('exporte', HOJE)).toMatchObject({ tipo: 'exportar', favorecido: '', todoPeriodo: true })
  })

  it('com período explícito não há todoPeriodo', () => {
    const c = interpretarComando('exporte para Maria de 1 a 8 de outubro', HOJE)
    expect(c).toMatchObject({ tipo: 'exportar', favorecido: 'Maria', de: '2026-10-01', ate: '2026-10-08' })
    expect('todoPeriodo' in c).toBe(false)
  })

  it('bordas da fala real', () => {
    expect(interpretarComando('exporta a lista do seu jerônimo de ontem até hoje', HOJE)).toEqual({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
      de: '2026-10-07',
      ate: '2026-10-08',
      filtroTipo: 'saidas',
    })
    expect(interpretarComando('me manda o relatório do jerônimo deste mês', HOJE)).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
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
    expect(interpretarComando('200 reais para o senhor Jerônimo', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('paguei 120 reais para o senhor Jerônimo dia 12 de março', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('', HOJE)).toEqual({ tipo: 'lancamento' })
    expect(interpretarComando('Jerônimo de 12 de março até 26 de março', HOJE)).toEqual({ tipo: 'lancamento' })
  })
})

describe('interpretarComando: sem período e favorecido conhecido em qualquer posição (Task 15d)', () => {
  const conhecidos = [
    { chave: 'roberto', nome: 'Roberto' },
    { chave: 'maria souza', nome: 'Maria Souza' },
    { chave: 'maria', nome: 'Maria' },
  ]
  const todo = { de: PERIODO_TUDO.de, ate: PERIODO_TUDO.ate, todoPeriodo: true }

  it.each([
    'exporte transações efetuadas roberto',
    'exporte as transações do senhor roberto',
    'exporta a lista do Roberto',
    'roberto exporte as transações',
    'me manda a lista de pagamentos efetuados ao roberto',
    'exporte o relatório do seu Roberto por favor',
    'exporte transações efetuadas Roberto',
  ])('%s -> tudo do Roberto', (fala) => {
    expect(interpretarComando(fala, HOJE, { favorecidosConhecidos: conhecidos })).toEqual({
      tipo: 'exportar',
      favorecido: 'Roberto',
      filtroTipo: 'saidas',
      ...todo,
    })
  })

  it('sem a lista de conhecidos, com preposição, o nome sai igual', () => {
    expect(interpretarComando('exporta a lista do Roberto', HOJE)).toMatchObject({ favorecido: 'Roberto', todoPeriodo: true })
    expect(interpretarComando('exporte as transações do senhor Roberto', HOJE)).toMatchObject({ favorecido: 'Roberto' })
  })

  it('o nome conhecido de mais palavras vence, na grafia cadastrada', () => {
    const c = interpretarComando('exporte as transações da dona maria souza', HOJE, { favorecidosConhecidos: conhecidos })
    expect(c).toMatchObject({ favorecido: 'Maria Souza', todoPeriodo: true })
    const m = interpretarComando('exporte as transações da maria', HOJE, { favorecidosConhecidos: conhecidos })
    expect(m).toMatchObject({ favorecido: 'Maria' })
  })

  it('nome conhecido junto com período explícito', () => {
    expect(interpretarComando('exporte transações efetuadas roberto do mês passado', HOJE, { favorecidosConhecidos: conhecidos })).toEqual({
      tipo: 'exportar',
      favorecido: 'Roberto',
      de: '2026-09-01',
      ate: '2026-09-30',
      filtroTipo: 'saidas',
    })
  })

  it('exporte tudo (sem favorecido e sem período): tudo de todos', () => {
    expect(interpretarComando('exporte tudo', HOJE, { favorecidosConhecidos: conhecidos })).toEqual({
      tipo: 'exportar',
      favorecido: '',
      filtroTipo: 'todas',
      ...todo,
    })
    expect(interpretarComando('exportar todas as transações efetuadas', HOJE)).toMatchObject({ favorecido: '', todoPeriodo: true })
  })

  it('nome desconhecido sem preposição é mantido (o app sugere parecidos; nunca exporta todos por engano)', () => {
    expect(interpretarComando('exporte transações efetuadas ricardo', HOJE, { favorecidosConhecidos: conhecidos })).toMatchObject({
      favorecido: 'Ricardo',
      todoPeriodo: true,
    })
    expect(interpretarComando('exporte transações efetuadas ricardo', HOJE)).toMatchObject({ favorecido: 'Ricardo' })
  })

  it('palavras do próprio pedido nunca viram nome', () => {
    for (const fala of [
      'exporte transações efetuadas',
      'exporte a lista de pagamentos',
      'exporte o relatório',
      'exporte tudo',
      'gerar lista de transações efetuadas',
      'me manda o extrato em pdf',
    ]) {
      expect(interpretarComando(fala, HOJE, { favorecidosConhecidos: conhecidos }), fala).toMatchObject({
        tipo: 'exportar',
        favorecido: '',
      })
    }
  })

  it('o nome conhecido não casa no meio de outra palavra', () => {
    // "mariana" contém "maria" mas é outra pessoa; sem preposição, vira nome desconhecido.
    expect(interpretarComando('exporte transações efetuadas mariana', HOJE, { favorecidosConhecidos: conhecidos })).toMatchObject({
      favorecido: 'Mariana',
    })
  })

  it('nenhuma frase devolve exportar_incompleto', () => {
    for (const fala of ['exporte', 'exporte para Roberto', 'exporte tudo', 'manda a lista']) {
      expect(interpretarComando(fala, HOJE).tipo).not.toBe('exportar_incompleto')
    }
  })

  it('lançamento continua lançamento', () => {
    expect(interpretarComando('paguei 120 reais para o roberto em 29 de setembro de 2026', HOJE, { favorecidosConhecidos: conhecidos })).toEqual({
      tipo: 'lancamento',
    })
  })
})
