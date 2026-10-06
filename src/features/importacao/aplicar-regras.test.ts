import { describe, it, expect } from 'vitest'
import { aplicarRegras, type Regra } from './aplicar-regras'

describe('aplicarRegras', () => {
  const regras: Regra[] = [
    { padrao: 'uber', categoriaId: 'transporte', prioridade: 1 },
    { padrao: 'uber eats', categoriaId: 'alimentacao', prioridade: 5 },
  ]

  it("'uber' casa 'UBER *TRIP' (contém, sem diferenciar maiúsculas)", () => {
    const r = aplicarRegras([{ descricao: 'UBER *TRIP' }], regras)
    expect(r[0].categoriaId).toBe('transporte')
  })

  it('com duas regras casando vence a de maior prioridade', () => {
    const r = aplicarRegras([{ descricao: 'UBER EATS PEDIDO' }], regras)
    expect(r[0].categoriaId).toBe('alimentacao')
  })

  it('a ordem do array não decide quando as prioridades diferem', () => {
    const r = aplicarRegras([{ descricao: 'UBER EATS PEDIDO' }], [...regras].reverse())
    expect(r[0].categoriaId).toBe('alimentacao')
  })

  it('sem match -> null', () => {
    const r = aplicarRegras([{ descricao: 'PADARIA' }], regras)
    expect(r[0].categoriaId).toBeNull()
  })

  it('padrão vazio é ignorado (não casa tudo)', () => {
    const r = aplicarRegras([{ descricao: 'PADARIA' }], [{ padrao: '  ', categoriaId: 'x', prioridade: 9 }])
    expect(r[0].categoriaId).toBeNull()
  })

  it('preserva os campos da linha e não muta a entrada', () => {
    const entrada = [{ descricao: 'UBER', valor: 1 }]
    const r = aplicarRegras(entrada, regras)
    expect(r[0]).toEqual({ descricao: 'UBER', valor: 1, categoriaId: 'transporte' })
    expect('categoriaId' in entrada[0]).toBe(false)
  })
})
