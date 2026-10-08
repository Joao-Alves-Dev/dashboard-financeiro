import { describe, expect, it } from 'vitest'
import { topComOutras, type GastoCategoria } from './agrupar'

const g = (i: number, total: number): GastoCategoria => ({ categoriaId: `c${i}`, nome: `Cat ${i}`, cor: '#112233', total })

describe('topComOutras', () => {
  it('até N itens: devolve como veio', () => {
    const l = [g(1, 500), g(2, 300)]
    expect(topComOutras(l, 8)).toEqual(l)
  })
  it('mais de N: top N por total + Outras com a soma do resto', () => {
    const l = Array.from({ length: 10 }, (_, i) => g(i, (i + 1) * 100)) // 100..1000 desordenado
    const r = topComOutras(l, 8)
    expect(r).toHaveLength(9)
    expect(r[0].total).toBe(1000)
    expect(r[7].total).toBe(300)
    expect(r[8]).toMatchObject({ categoriaId: null, nome: 'Outras', total: 100 + 200, cor: null, agrupadas: 2 })
  })
  it('a soma total se preserva', () => {
    const l = Array.from({ length: 12 }, (_, i) => g(i, i * 37 + 11))
    const soma = (x: { total: number }[]) => x.reduce((a, b) => a + b.total, 0)
    expect(soma(topComOutras(l, 8))).toBe(soma(l))
  })
  it('lista vazia', () => {
    expect(topComOutras([], 8)).toEqual([])
  })
  it('rótulo da sobra é configurável', () => {
    const l = Array.from({ length: 3 }, (_, i) => g(i, 10 + i))
    expect(topComOutras(l, 2, 'Others').at(-1)?.nome).toBe('Others')
  })
})
