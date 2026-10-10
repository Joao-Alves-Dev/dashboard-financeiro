import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraCartaoAlto } from './cartao-alto'

describe('cartao-alto', () => {
  it('cartão 180.000 com renda 500.000 (36%) e limite 30 -> atencao', () => {
    const r = regraCartaoAlto(ctx({ rendaMes: 500_000, gastoCartaoMes: 180_000 }), cfg({ cartaoPct: 30 }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'cartao-alto', chave: '', severidade: 'atencao', dicaId: 'juros-cartao' })
    expect(r[0].texto).toContain('36%')
    expect(r[0].texto).toContain('1.800,00')
    expect(r[0].texto).toContain('30%')
  })

  it('no limite (30%) não dispara', () => {
    expect(regraCartaoAlto(ctx({ rendaMes: 500_000, gastoCartaoMes: 150_000 }), cfg({ cartaoPct: 30 }))).toEqual([])
  })

  it('sem renda -> []', () => {
    expect(regraCartaoAlto(ctx({ rendaMes: 0, gastoCartaoMes: 180_000 }), cfg())).toEqual([])
  })
})
