import { describe, expect, it } from 'vitest'
import { extensoParaNumero, ehPalavraNumerica } from './numeros-extenso'

describe('extensoParaNumero', () => {
  it.each([
    ['duzentos', 200],
    ['mil e duzentos', 1200],
    ['dois mil e trinta', 2030],
    ['cinco mil e quinhentos', 5500],
    ['cinquenta', 50],
    ['cem', 100],
    ['cento e vinte e dois', 122],
    ['vinte e cinco', 25],
    ['mil', 1000],
    ['um', 1],
    ['uma', 1],
    ['duas', 2],
    ['dezessete', 17],
    ['novecentos e noventa e nove mil novecentos e noventa e nove', 999999],
    ['um milhão e quinhentos mil', 1500000],
    ['dois milhões', 2000000],
    ['Duzentos', 200],
    ['três mil', 3000],
  ])('%s -> %i', (texto, esperado) => {
    expect(extensoParaNumero(texto)).toBe(esperado)
  })

  it.each(['banana', '', '   ', 'e', 'mil e', 'e mil', 'dois três', 'cem cem', 'vinte vinte', 'mil mil'])(
    '%j -> null',
    (texto) => {
      expect(extensoParaNumero(texto)).toBeNull()
    },
  )

  it('ehPalavraNumerica reconhece palavras de número sem acento e com acento', () => {
    expect(ehPalavraNumerica('três')).toBe(true)
    expect(ehPalavraNumerica('tres')).toBe(true)
    expect(ehPalavraNumerica('reais')).toBe(false)
  })
})
