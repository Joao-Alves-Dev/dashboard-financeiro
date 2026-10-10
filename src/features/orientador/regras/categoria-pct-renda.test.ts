import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraCategoriaPctRenda } from './categoria-pct-renda'

const alimentacao = { id: 'c1', nome: 'Alimentação', gastoMes: 110_000, mediaTresMeses: 0 }

describe('categoria-pct-renda', () => {
  it('renda 500.000 e Alimentação 110.000 com limite 15 -> 1 alerta atencao com "22%"', () => {
    const r = regraCategoriaPctRenda(ctx({ rendaMes: 500_000, categorias: [alimentacao] }), cfg({ limiteCategoriaPct: 15 }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      regraId: 'categoria-pct-renda',
      chave: 'c1',
      severidade: 'atencao',
      dicaId: 'orcamento-50-30-20',
    })
    expect(r[0].texto).toContain('22%')
    expect(r[0].texto).toContain('1.100,00')
    expect(r[0].texto).toContain('15%')
    expect(r[0].texto).toContain('Alimentação')
  })

  it('renda 0 -> []', () => {
    expect(regraCategoriaPctRenda(ctx({ rendaMes: 0, categorias: [alimentacao] }), cfg())).toEqual([])
  })

  it('exatamente no limite (15%) não dispara; só acima', () => {
    const c = { id: 'c1', nome: 'Moradia', gastoMes: 75_000, mediaTresMeses: 0 }
    expect(regraCategoriaPctRenda(ctx({ rendaMes: 500_000, categorias: [c] }), cfg())).toEqual([])
    expect(regraCategoriaPctRenda(ctx({ rendaMes: 500_000, categorias: [{ ...c, gastoMes: 75_001 }] }), cfg())).toHaveLength(1)
  })

  it('o percentual exibido nunca fica igual ou abaixo do limite quando o alerta dispara (15,4% -> 16%)', () => {
    const c = { id: 'c1', nome: 'Moradia', gastoMes: 77_000, mediaTresMeses: 0 }
    const r = regraCategoriaPctRenda(ctx({ rendaMes: 500_000, categorias: [c] }), cfg())
    expect(r[0].texto).toContain('16%')
  })

  it('uma instância por categoria, com a chave da categoria', () => {
    const r = regraCategoriaPctRenda(
      ctx({
        rendaMes: 500_000,
        categorias: [
          alimentacao,
          { id: 'c2', nome: 'Lazer', gastoMes: 100_000, mediaTresMeses: 0 },
          { id: 'c3', nome: 'Café', gastoMes: 1, mediaTresMeses: 0 },
        ],
      }),
      cfg(),
    )
    expect(r.map((a) => a.chave)).toEqual(['c1', 'c2'])
  })
})
