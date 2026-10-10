import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraOrcamento } from './orcamento'

const orc = (orcado: number, realizado: number, categoriaId = 'c1') => ({ categoriaId, nome: 'Lazer', orcado, realizado })

describe('orcamento-80 / orcamento-100', () => {
  it('85% do orçado -> orcamento-80, atencao', () => {
    const r = regraOrcamento(ctx({ orcamentos: [orc(100_000, 85_000)] }), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'orcamento-80', chave: 'c1', severidade: 'atencao', dicaId: 'orcamento-realista' })
    expect(r[0].texto).toContain('85%')
  })

  it('100% do orçado -> só orcamento-100, critico (sem duplicar com o de 80)', () => {
    const r = regraOrcamento(ctx({ orcamentos: [orc(100_000, 100_000)] }), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'orcamento-100', severidade: 'critico', dicaId: 'orcamento-realista' })
  })

  it('acima de 100% informa quanto passou', () => {
    const r = regraOrcamento(ctx({ orcamentos: [orc(100_000, 115_000)] }), cfg())
    expect(r[0].regraId).toBe('orcamento-100')
    expect(r[0].texto).toContain('150,00')
  })

  it('limiares: 79,99% não dispara; exatamente 80% dispara', () => {
    expect(regraOrcamento(ctx({ orcamentos: [orc(100_000, 79_999)] }), cfg())).toEqual([])
    expect(regraOrcamento(ctx({ orcamentos: [orc(100_000, 80_000)] }), cfg())[0].regraId).toBe('orcamento-80')
  })

  it('99,9% mostra 99% (nunca arredonda para 100% um alerta de atenção)', () => {
    const r = regraOrcamento(ctx({ orcamentos: [orc(100_000, 99_900)] }), cfg())
    expect(r[0].regraId).toBe('orcamento-80')
    expect(r[0].texto).toContain('99%')
  })

  it('sem orçamento (orçado 0) nunca dispara; uma instância por categoria', () => {
    expect(regraOrcamento(ctx({ orcamentos: [orc(0, 50_000)] }), cfg())).toEqual([])
    const r = regraOrcamento(ctx({ orcamentos: [orc(100, 90, 'a'), orc(100, 120, 'b'), orc(100, 10, 'c')] }), cfg())
    expect(r.map((a) => [a.chave, a.regraId])).toEqual([
      ['a', 'orcamento-80'],
      ['b', 'orcamento-100'],
    ])
  })
})
