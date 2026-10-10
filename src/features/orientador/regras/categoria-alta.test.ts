import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraCategoriaAlta } from './categoria-alta'

const cat = (gastoMes: number, mediaTresMeses: number, id = 'c1') => ({ id, nome: 'Transporte', gastoMes, mediaTresMeses })

describe('categoria-alta', () => {
  it('média 10.000, mês 14.100, altaPct 30 -> alerta atencao com 41%', () => {
    const r = regraCategoriaAlta(ctx({ categorias: [cat(14_100, 10_000)] }), cfg({ altaPct: 30 }))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'categoria-alta', chave: 'c1', severidade: 'atencao', dicaId: 'revisar-habitos' })
    expect(r[0].texto).toContain('41%')
    expect(r[0].texto).toContain('141,00')
    expect(r[0].texto).toContain('100,00')
  })

  it('média 0 -> []', () => {
    expect(regraCategoriaAlta(ctx({ categorias: [cat(50_000, 0)] }), cfg())).toEqual([])
  })

  it('exatamente no limite (13.000 = +30%) não dispara; 13.001 dispara', () => {
    expect(regraCategoriaAlta(ctx({ categorias: [cat(13_000, 10_000)] }), cfg({ altaPct: 30 }))).toEqual([])
    expect(regraCategoriaAlta(ctx({ categorias: [cat(13_001, 10_000)] }), cfg({ altaPct: 30 }))).toHaveLength(1)
  })

  it('o percentual exibido supera o limite mesmo no arredondamento (30,01% -> 31%)', () => {
    const r = regraCategoriaAlta(ctx({ categorias: [cat(13_001, 10_000)] }), cfg({ altaPct: 30 }))
    expect(r[0].texto).toContain('31%')
  })

  it('respeita altaPct configurado', () => {
    expect(regraCategoriaAlta(ctx({ categorias: [cat(14_100, 10_000)] }), cfg({ altaPct: 50 }))).toEqual([])
  })
})
