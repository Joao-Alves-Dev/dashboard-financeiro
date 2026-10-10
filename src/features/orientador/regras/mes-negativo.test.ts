import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { DIA_MINIMO_MES_NEGATIVO, regraMesNegativo } from './mes-negativo'

describe('mes-negativo', () => {
  it('dia 10 de 30, saídas 200.000, renda 500.000 -> projeção 600.000 -> critico', () => {
    const r = regraMesNegativo(ctx({ diaDoMes: 10, diasNoMes: 30, saidasMes: 200_000, rendaMes: 500_000 }), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'mes-negativo', chave: '', severidade: 'critico', dicaId: 'cortar-gastos' })
    expect(r[0].texto).toContain('6.000,00')
    expect(r[0].texto).toContain('5.000,00')
  })

  it('projeção igual ou menor que a renda -> []', () => {
    expect(regraMesNegativo(ctx({ diaDoMes: 10, diasNoMes: 30, saidasMes: 166_666, rendaMes: 500_000 }), cfg())).toEqual([])
    expect(regraMesNegativo(ctx({ diaDoMes: 10, diasNoMes: 30, saidasMes: 100_000, rendaMes: 500_000 }), cfg())).toEqual([])
  })

  it('renda do mês 0 -> nunca dispara', () => {
    expect(regraMesNegativo(ctx({ diaDoMes: 20, diasNoMes: 30, saidasMes: 900_000, rendaMes: 0 }), cfg())).toEqual([])
  })

  it('antes do dia mínimo não dispara (projeção seria ruído); a partir dele sim', () => {
    const base = { diasNoMes: 30, saidasMes: 100_000, rendaMes: 500_000 }
    expect(DIA_MINIMO_MES_NEGATIVO).toBe(5)
    expect(regraMesNegativo(ctx({ ...base, diaDoMes: DIA_MINIMO_MES_NEGATIVO - 1 }), cfg())).toEqual([])
    expect(regraMesNegativo(ctx({ ...base, diaDoMes: DIA_MINIMO_MES_NEGATIVO }), cfg())).toHaveLength(1)
  })
})
