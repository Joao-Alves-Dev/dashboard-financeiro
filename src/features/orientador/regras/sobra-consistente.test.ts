import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraSobraConsistente } from './sobra-consistente'

describe('sobra-consistente', () => {
  it('[100, 50, 1] -> positivo, sugere "Onde deixar o dinheiro guardado"', () => {
    const r = regraSobraConsistente(ctx({ resultadosTresMeses: [100_000, 50_000, 1] }), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'sobra-consistente', chave: '', severidade: 'positivo', dicaId: 'onde-guardar' })
    expect(r[0].texto).toContain('Onde deixar o dinheiro guardado')
    expect(r[0].texto).toContain('R$')
  })

  it('[100, -1, 50] -> []', () => {
    expect(regraSobraConsistente(ctx({ resultadosTresMeses: [100, -1, 50] }), cfg())).toEqual([])
  })

  it('zero não é sobra', () => {
    expect(regraSobraConsistente(ctx({ resultadosTresMeses: [100, 0, 50] }), cfg())).toEqual([])
  })

  it('menos de 3 meses de dados -> []', () => {
    expect(regraSobraConsistente(ctx({ resultadosTresMeses: [100, 50] }), cfg())).toEqual([])
    expect(regraSobraConsistente(ctx({ resultadosTresMeses: [] }), cfg())).toEqual([])
  })
})
