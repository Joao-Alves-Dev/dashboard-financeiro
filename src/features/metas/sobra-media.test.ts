import { describe, expect, it } from 'vitest'
import { mediaArredondada, mesesFechados } from './sobra-media'

describe('mesesFechados', () => {
  it('3 meses anteriores ao mês de hoje, do mais antigo ao mais recente', () => {
    expect(mesesFechados('2026-10-15', 3)).toEqual({ de: '2026-07-01', ate: '2026-09-30' })
  })
  it('virada de ano: hoje 2027-01-10 -> out/nov/dez de 2026', () => {
    expect(mesesFechados('2027-01-10', 3)).toEqual({ de: '2026-10-01', ate: '2026-12-31' })
  })
  it('o mês de hoje nunca entra, nem no dia 1', () => {
    expect(mesesFechados('2026-03-01', 3)).toEqual({ de: '2025-12-01', ate: '2026-02-28' })
  })
})

describe('mediaArredondada', () => {
  it('média inteira arredondada ao mais próximo', () => {
    expect(mediaArredondada([100, 200, 300])).toBe(200)
    expect(mediaArredondada([100, 100, 101])).toBe(100)
    expect(mediaArredondada([100, 100, 102])).toBe(101)
  })
  it('metades se afastam de zero (simétrico para negativos)', () => {
    expect(mediaArredondada([1, 1, 0, 0])).toBe(1) // 0,5 -> 1
    expect(mediaArredondada([-1, -1, 0, 0])).toBe(-1) // -0,5 -> -1
  })
  it('negativos e mistura', () => {
    expect(mediaArredondada([-300, 0, 0])).toBe(-100)
    expect(mediaArredondada([100, -50, 0])).toBe(17)
  })
  it('lista vazia = 0', () => {
    expect(mediaArredondada([])).toBe(0)
  })
})
