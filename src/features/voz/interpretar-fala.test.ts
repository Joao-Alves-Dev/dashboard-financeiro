import { describe, expect, it } from 'vitest'
import { interpretarFala, type FalaInterpretada } from './interpretar-fala'

const HOJE = '2026-10-15'

function ok(texto: string, hoje = HOJE) {
  const r = interpretarFala(texto, hoje)
  if (!r.ok) throw new Error(`esperava ok para ${JSON.stringify(texto)}, veio ${r.motivo}`)
  return r
}

describe('interpretarFala: casos do plano', () => {
  it('200 reais para o senhor Jerônimo', () => {
    expect(interpretarFala('200 reais para o senhor Jerônimo', HOJE)).toEqual({
      ok: true,
      valorCentavos: -20000,
      descricao: 'Para o senhor Jerônimo',
      data: '2026-10-15',
      favorecido: 'Jerônimo',
    })
  })

  it('boleto de 5 mil reais referente ao financiamento da van', () => {
    const r = ok('pagamento do boleto de 5 mil reais referente a financiamento da van Renault')
    expect(r.valorCentavos).toBe(-500000)
    expect(r.descricao).toContain('financiamento da van Renault')
    expect(r.descricao[0]).toBe('B')
    expect(r.descricao).toBe('Boleto referente a financiamento da van Renault')
    expect(r.favorecido).toBeUndefined()
  })

  it('R$ 1.500,50 conta de luz', () => {
    const r = ok('R$ 1.500,50 conta de luz')
    expect(r.valorCentavos).toBe(-150050)
    expect(r.descricao).toBe('Conta de luz')
  })

  it('recebi 350 reais do João é entrada com favorecido', () => {
    expect(interpretarFala('recebi 350 reais do João', HOJE)).toEqual({
      ok: true,
      valorCentavos: 35000,
      descricao: 'Do João',
      data: HOJE,
      favorecido: 'João',
    })
  })

  it('200 reais de gasolina não tem favorecido', () => {
    const r = ok('200 reais de gasolina')
    expect(r.valorCentavos).toBe(-20000)
    expect('favorecido' in r).toBe(false)
  })

  it('200 reais e 50 centavos padaria', () => {
    const r = ok('200 reais e 50 centavos padaria')
    expect(r.valorCentavos).toBe(-20050)
    expect(r.descricao).toBe('Padaria')
  })

  it('cinco mil e quinhentos de aluguel', () => {
    expect(ok('cinco mil e quinhentos de aluguel').valorCentavos).toBe(-550000)
  })

  it('datas', () => {
    expect(ok('ontem paguei 80 reais de gasolina').data).toBe('2026-10-14')
    expect(ok('anteontem paguei 80 reais de gasolina').data).toBe('2026-10-13')
    expect(ok('dia 20 paguei 50 reais').data).toBe('2026-09-20')
    expect(ok('dia 3 paguei 50 reais').data).toBe('2026-10-03')
    expect(ok('dia 5 de outubro paguei 50 reais').data).toBe('2026-10-05')
    expect(ok('dia 10 de dezembro paguei 50 reais').data).toBe('2025-12-10')
  })

  it('dia 12 de março paguei 120 reais para o senhor Jerônimo (hoje 2026-03-26)', () => {
    const r = ok('dia 12 de março paguei 120 reais para o senhor Jerônimo', '2026-03-26')
    expect(r).toEqual({
      ok: true,
      valorCentavos: -12000,
      descricao: 'Para o senhor Jerônimo',
      data: '2026-03-12',
      favorecido: 'Jerônimo',
    })
  })

  it('sem valor e vazio', () => {
    expect(interpretarFala('para o senhor Jerônimo', HOJE)).toEqual({ ok: false, motivo: 'sem_valor' })
    expect(interpretarFala('   ', HOJE)).toEqual({ ok: false, motivo: 'vazio' })
    expect(interpretarFala('', HOJE)).toEqual({ ok: false, motivo: 'vazio' })
  })
})

describe('interpretarFala: capitalização do favorecido (Chrome devolve minúsculas)', () => {
  it.each([
    ['200 reais para o senhor jerônimo', 'Jerônimo'],
    ['recebi 350 reais da maria josé', 'Maria José'],
    ['paguei 50 reais para joão da silva', 'João da Silva'],
    ['paguei 50 reais para a dona maria de fátima', 'Maria de Fátima'],
    ['paguei 50 reais pra seu zé', 'Zé'],
    ['paguei 50 reais para o sr. antônio dos santos', 'Antônio dos Santos'],
    ['recebi 350 reais do JOÃO', 'João'],
  ])('%s -> %s', (fala, nome) => {
    expect(ok(fala).favorecido).toBe(nome)
  })

  it('só tratamento não vira favorecido', () => {
    expect('favorecido' in ok('paguei 50 reais para o senhor')).toBe(false)
  })
})

describe('interpretarFala: tipo (entrada/saída)', () => {
  it.each([
    'recebi 100 reais',
    'recebimento de 100 reais',
    'ele me pagou 100 reais',
    'entrou 100 reais',
    'valor recebido 100 reais',
    'RECEBI 100 reais',
  ])('%s é entrada', (fala) => {
    expect(ok(fala).valorCentavos).toBe(10000)
  })

  it.each(['paguei 100 reais', 'pagamento de 100 reais', 'gastei 100 reais', '100 reais'])('%s é saída', (fala) => {
    expect(ok(fala).valorCentavos).toBe(-10000)
  })

  it('palavras-chave ignoram acento e maiúsculas, descrição preserva acento', () => {
    const r = ok('Recebi 100 reais de Aluguel da Mãe')
    expect(r.valorCentavos).toBe(10000)
    expect(r.descricao).toContain('Mãe')
  })
})

describe('interpretarFala: valores', () => {
  it.each([
    ['R$ 50,5 mercado', -5050],
    ['R$50,50 mercado', -5050],
    ['cinquenta reais', -5000],
    ['dois mil e trinta reais de reforma', -203000],
    ['mil reais de entrada', -100000],
    ['um real de troco', -100],
    ['200,00 reais padaria', -20000],
    ['paguei 80 de gasolina', -8000],
    ['1.500 reais de aluguel', -150000],
    ['5 mil reais', -500000],
    ['5 mil e 500 reais', -550000],
    ['5 mil e quinhentos reais', -550000],
    ['5000 reais', -500000],
    ['50 centavos de bala', -50],
    ['cinco mil e quinhentos reais e vinte centavos', -550020],
    ['200 reais 50 centavos', -20050],
    ['vinte e cinco reais', -2500],
    ['2 milhões de reais da venda', -200000000],
  ])('%s -> %i', (fala, esperado) => {
    expect(ok(fala).valorCentavos).toBe(esperado)
  })

  it('com vários números, vale o primeiro valor monetário', () => {
    expect(ok('paguei 200 reais e depois 300 reais').valorCentavos).toBe(-20000)
    expect(ok('boleto 2020 de 150 reais').valorCentavos).toBe(-15000)
    expect(ok('paguei um boleto de 150 reais').valorCentavos).toBe(-15000)
  })

  it('valor zero não vale', () => {
    expect(interpretarFala('zero reais', HOJE)).toEqual({ ok: false, motivo: 'sem_valor' })
  })

  it('número de "dia N" não vira valor', () => {
    expect(interpretarFala('dia 20', HOJE)).toEqual({ ok: false, motivo: 'sem_valor' })
  })
})

describe('interpretarFala: datas (decisões)', () => {
  it('dia futuro no mês corrente cai no mês anterior (dia 3 com hoje dia 2)', () => {
    expect(ok('dia 3 paguei 10 reais', '2026-10-02').data).toBe('2026-09-03')
  })
  it('virada de ano', () => {
    expect(ok('dia 28 paguei 10 reais', '2026-01-05').data).toBe('2025-12-28')
    expect(ok('ontem paguei 10 reais', '2026-01-01').data).toBe('2025-12-31')
  })
  it('"no dia 20" não deixa preposição sobrando', () => {
    expect(ok('no dia 20 paguei 50 reais de mercado').descricao).toBe('De mercado')
  })
  it('data com mês e ano explícitos', () => {
    expect(ok('dia 5 de março de 2025 paguei 10 reais').data).toBe('2025-03-05')
  })
  it('dia inválido é ignorado e a data fica hoje', () => {
    expect(ok('dia 40 paguei 10 reais').data).toBe(HOJE)
    expect(ok('dia 31 de fevereiro paguei 10 reais').data).toBe(HOJE)
  })
  it('hoje é removido da descrição', () => {
    const r = ok('hoje paguei 10 reais de pão')
    expect(r.data).toBe(HOJE)
    expect(r.descricao).toBe('De pão')
  })
})

describe('interpretarFala: descrição', () => {
  it('vazia vira "Lançamento por voz"', () => {
    expect(ok('paguei 100 reais').descricao).toBe('Lançamento por voz')
    expect(ok('pagamento de 100 reais').descricao).toBe('Lançamento por voz')
    expect(ok('100 reais').descricao).toBe('Lançamento por voz')
  })
  it('primeira letra maiúscula, resto preservado', () => {
    expect(ok('paguei 30 reais conta de luz').descricao).toBe('Conta de luz')
  })
  it('limita a 200 caracteres', () => {
    const longa = 'compra ' + 'muito '.repeat(60)
    expect(ok(`100 reais ${longa}`).descricao.length).toBeLessThanOrEqual(200)
  })
  it('entrada com favorecido logo depois do comando: "recebi do João 350 reais"', () => {
    const r = ok('recebi do joão 350 reais')
    expect(r.valorCentavos).toBe(35000)
    expect(r.favorecido).toBe('João')
  })
  it('"de aluguel" em entrada não vira favorecido', () => {
    expect('favorecido' in ok('recebi 800 reais de aluguel')).toBe(false)
  })
  it('favorecido "para" depois de descrição', () => {
    const r = ok('paguei 120 reais de conserto para o carlos referente ao carro')
    expect(r.favorecido).toBe('Carlos')
  })
})

describe('tipo de retorno', () => {
  it('é uma união discriminada por ok', () => {
    const r: FalaInterpretada = interpretarFala('10 reais', HOJE)
    expect(r.ok).toBe(true)
  })
})

describe('interpretarFala: data completa falada (Task 15d, hoje = 2026-10-08)', () => {
  const H = '2026-10-08'

  it.each([
    'paguei 120 reais para o roberto em 29 de setembro de 2026',
    'paguei 120 reais para o roberto no dia 29 de setembro de 2026',
    'paguei 120 reais para o roberto dia 29 de setembro de 2026',
    'paguei 120 reais para o roberto 29 de setembro de 2026',
    'paguei 120 reais para o roberto em 29 de setembro',
    'paguei 120 reais para o roberto 29 de 9 de 2026',
    'paguei 120 reais para o roberto 29 do 9 de 2026',
    'paguei 120 reais para o roberto em 29/09/2026',
    'paguei 120 reais para o roberto 29/09',
    'paguei 120 reais para o roberto 29-09-2026',
    'paguei 120 reais para o roberto 29.09.2026',
    'paguei 120 reais para o roberto data 29/09/2026',
    'paguei 120 reais para o roberto em vinte e nove de setembro de dois mil e vinte e seis',
    'paguei cento e vinte reais para o roberto em vinte e nove de nove de dois mil e vinte e seis',
    'paguei 120 reais para o roberto dia vinte e nove de setembro',
    'paguei 120 reais para o roberto dia 29/09/2026',
  ])('%s', (fala) => {
    const r = ok(fala, H)
    expect(r.data).toBe('2026-09-29')
    expect(r.valorCentavos).toBe(-12000)
    expect(r.favorecido).toBe('Roberto')
    // As palavras da data não ficam na descrição.
    expect(r.descricao).toBe('Para o roberto')
  })

  it('data no começo da frase e sem marca de dinheiro', () => {
    expect(ok('29/09/2026 paguei 120 reais', H)).toMatchObject({ data: '2026-09-29', valorCentavos: -12000 })
    expect(ok('120 reais dia 29/09/2026', H)).toMatchObject({ data: '2026-09-29', valorCentavos: -12000 })
    const r = ok('paguei 120 para o roberto em 29 de setembro de 2026', H)
    expect(r).toMatchObject({ data: '2026-09-29', valorCentavos: -12000, favorecido: 'Roberto' })
  })

  it('a data falada nunca vira o valor', () => {
    expect(ok('paguei 2026 reais dia 29/09/2026', H)).toMatchObject({ data: '2026-09-29', valorCentavos: -202600 })
    expect(ok('paguei 9 reais em 29 de 9 de 2026', H)).toMatchObject({ data: '2026-09-29', valorCentavos: -900 })
    expect(ok('recebi 29 reais em 29/09/2026', H)).toMatchObject({ data: '2026-09-29', valorCentavos: 2900 })
    expect(interpretarFala('em 29 de setembro de 2026', H)).toEqual({ ok: false, motivo: 'sem_valor' })
    expect(interpretarFala('29/09/2026', H)).toEqual({ ok: false, motivo: 'sem_valor' })
  })

  it('"mil" e "dois mil" do valor não são confundidos com o ano', () => {
    expect(ok('paguei mil reais em 29 de setembro de dois mil e vinte e seis', H)).toMatchObject({
      data: '2026-09-29',
      valorCentavos: -100000,
    })
    expect(ok('paguei dia 29 de setembro de dois mil reais', H)).toMatchObject({
      data: '2026-09-29',
      valorCentavos: -200000,
    })
    expect(ok('paguei dois mil reais em vinte e nove de nove de dois mil e vinte e seis', H)).toMatchObject({
      data: '2026-09-29',
      valorCentavos: -200000,
    })
  })

  it('ano omitido segue a regra atual; futuro explícito é aceito', () => {
    expect(ok('paguei 50 reais 29 de setembro', H).data).toBe('2026-09-29')
    expect(ok('paguei 50 reais 15 de dezembro', H).data).toBe('2025-12-15')
    expect(ok('paguei 50 reais 15/12', H).data).toBe('2025-12-15')
    expect(ok('paguei 50 reais em 15 de dezembro de 2026', H).data).toBe('2026-12-15')
    expect(ok('paguei 50 reais em 15/12/2027', H).data).toBe('2027-12-15')
  })

  it('ano de dois dígitos com barra', () => {
    expect(ok('paguei 50 reais em 29/09/26', H).data).toBe('2026-09-29')
  })

  it('data inválida é ignorada: fica hoje e as palavras ficam na descrição', () => {
    for (const [fala, trecho] of [
      ['paguei 100 reais em 31/02/2026', '31/02/2026'],
      ['paguei 100 reais em 31 de abril de 2026', '31 de abril de 2026'],
      ['paguei 100 reais em 29/02/2026', '29/02/2026'],
      ['paguei 100 reais em 29 de setembro de 1999', '29 de setembro de 1999'],
      ['paguei 100 reais em 29/09/2101', '29/09/2101'],
    ] as const) {
      const r = ok(fala, H)
      expect(r.data, fala).toBe(H)
      expect(r.valorCentavos, fala).toBe(-10000)
      expect(r.descricao, fala).toContain(trecho)
    }
  })

  it('ano bissexto vale', () => {
    expect(ok('paguei 100 reais em 29/02/2028', H).data).toBe('2028-02-29')
  })

  it('números comuns continuam sendo valor', () => {
    expect(ok('paguei 29 reais', H)).toMatchObject({ data: H, valorCentavos: -2900 })
    expect(ok('paguei 1.500,50 de aluguel', H)).toMatchObject({ data: H, valorCentavos: -150050 })
    expect(ok('paguei 10.000 reais', H)).toMatchObject({ data: H, valorCentavos: -1000000 })
    expect(ok('dia 20 paguei 50 reais', H).data).toBe('2026-09-20')
  })
})
