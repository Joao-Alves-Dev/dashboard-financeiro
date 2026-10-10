import { describe, expect, it } from 'vitest'
import { valorPorExtenso } from './valor-por-extenso'

describe('valorPorExtenso', () => {
  it.each([
    [20000, 'duzentos reais'],
    [150050, 'mil e quinhentos reais e cinquenta centavos'],
    [100, 'um real'],
    [101, 'um real e um centavo'],
    [50, 'cinquenta centavos'],
    [1, 'um centavo'],
    [0, 'zero reais'],
    [10000, 'cem reais'],
    [10100, 'cento e um reais'],
    [500000, 'cinco mil reais'],
    [203000, 'dois mil e trinta reais'],
    [123400, 'mil duzentos e trinta e quatro reais'],
    [-20000, 'duzentos reais'],
    [100000000, 'um milhão de reais'],
    [150000000, 'um milhão e quinhentos mil reais'],
    [8000, 'oitenta reais'],
    [35000, 'trezentos e cinquenta reais'],
  ])('%i -> %s', (centavos, esperado) => {
    expect(valorPorExtenso(centavos)).toBe(esperado)
  })
})
