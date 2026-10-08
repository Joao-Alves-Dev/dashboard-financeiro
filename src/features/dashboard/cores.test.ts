import { describe, expect, it } from 'vitest'
import { contraste, corDaBarra } from './cores'

describe('contraste WCAG', () => {
  it('preto/branco = 21; igual = 1', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contraste('#777777', '#777777')).toBeCloseTo(1, 5)
  })
})

describe('corDaBarra', () => {
  it('mantém a cor da categoria quando passa 3:1 nas duas superfícies', () => {
    expect(corDaBarra('#2a78d6', 0)).toEqual({ tipo: 'categoria', cor: '#2a78d6' })
  })
  it('cai para o slot categórico quando a cor é clara demais no claro', () => {
    expect(corDaBarra('#fde68a', 2)).toEqual({ tipo: 'slot', slot: 3 })
  })
  it('cai para o slot quando é escura demais no escuro', () => {
    expect(corDaBarra('#1e1b4b', 0)).toEqual({ tipo: 'slot', slot: 1 })
  })
  it('cor inválida usa o slot; índice dá a volta nos 8 slots', () => {
    expect(corDaBarra('xyz', 9)).toEqual({ tipo: 'slot', slot: 2 })
    expect(corDaBarra(null, 0)).toEqual({ tipo: 'slot', slot: 1 })
  })
})
