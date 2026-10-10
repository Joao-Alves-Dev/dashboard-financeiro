import { describe, expect, it } from 'vitest'
import { agruparPorTema, filtrarDicas, type DicaResumo } from './filtrar'

const dicas: DicaResumo[] = [
  { id: 'a', titulo: 'Os juros do cartão de crédito', tema: 'dividas', resumo: 'Fatura, rotativo e parcelas.' },
  { id: 'b', titulo: 'Reserva de emergência: por que e quanto', tema: 'guardar', resumo: 'Dinheiro separado para imprevistos.' },
  { id: 'c', titulo: 'FGC: a proteção', tema: 'investir', resumo: 'O que o Fundo Garantidor cobre.' },
  { id: 'd', titulo: 'Juros compostos', tema: 'investir', resumo: 'Juros sobre juros.' },
]

describe('filtrarDicas', () => {
  it('termo vazio ou só espaços devolve tudo, na mesma ordem', () => {
    expect(filtrarDicas(dicas, '')).toEqual(dicas)
    expect(filtrarDicas(dicas, '   ')).toEqual(dicas)
  })

  it('busca no título e no resumo, sem diferenciar maiúsculas', () => {
    expect(filtrarDicas(dicas, 'CARTÃO').map((d) => d.id)).toEqual(['a'])
    expect(filtrarDicas(dicas, 'imprevistos').map((d) => d.id)).toEqual(['b'])
  })

  it('ignora acentos nos dois lados', () => {
    expect(filtrarDicas(dicas, 'cartao').map((d) => d.id)).toEqual(['a'])
    expect(filtrarDicas(dicas, 'protecao').map((d) => d.id)).toEqual(['c'])
    expect(filtrarDicas(dicas, 'emergência').map((d) => d.id)).toEqual(['b'])
  })

  it('várias palavras: todas precisam aparecer (em qualquer ordem)', () => {
    expect(filtrarDicas(dicas, 'juros cartao').map((d) => d.id)).toEqual(['a'])
    expect(filtrarDicas(dicas, 'cartao juros').map((d) => d.id)).toEqual(['a'])
    expect(filtrarDicas(dicas, 'juros').map((d) => d.id)).toEqual(['a', 'd'])
  })

  it('sem resultado devolve lista vazia', () => {
    expect(filtrarDicas(dicas, 'criptomoeda')).toEqual([])
  })

  it('caracteres especiais não quebram', () => {
    expect(filtrarDicas(dicas, '(*[')).toEqual([])
  })
})

describe('agruparPorTema', () => {
  it('agrupa na ordem dos temas e omite temas vazios', () => {
    const g = agruparPorTema(dicas, ['orcamento', 'guardar', 'dividas', 'investir'])
    expect(g.map((x) => [x.tema, x.dicas.map((d) => d.id)])).toEqual([
      ['guardar', ['b']],
      ['dividas', ['a']],
      ['investir', ['c', 'd']],
    ])
  })
})
