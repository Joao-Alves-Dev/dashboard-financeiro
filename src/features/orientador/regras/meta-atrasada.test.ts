import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraMetaAtrasada } from './meta-atrasada'

const meta = (situacao: 'no_ritmo' | 'atrasada' | 'concluida' | 'vencida', sobraMedia = 45_000) => ({
  id: 'm1',
  nome: 'Viagem',
  situacao,
  necessarioPorMes: 60_000,
  sobraMedia,
})

describe('meta-atrasada', () => {
  it('meta atrasada -> atencao, com necessário e sobra média', () => {
    const r = regraMetaAtrasada(ctx({ metas: [meta('atrasada')] }), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'meta-atrasada', chave: 'm1', severidade: 'atencao', dicaId: 'metas-ritmo' })
    expect(r[0].texto).toContain('Viagem')
    expect(r[0].texto).toContain('600,00')
    expect(r[0].texto).toContain('450,00')
  })

  it('outras situações não disparam', () => {
    for (const s of ['no_ritmo', 'concluida', 'vencida'] as const) {
      expect(regraMetaAtrasada(ctx({ metas: [meta(s)] }), cfg())).toEqual([])
    }
  })

  it('sobra média zero ou negativa tem texto próprio, sem valor negativo', () => {
    const r = regraMetaAtrasada(ctx({ metas: [meta('atrasada', -20_000)] }), cfg())
    expect(r[0].texto).not.toContain('-R$')
    expect(r[0].texto).toContain('não sobrou')
  })
})
