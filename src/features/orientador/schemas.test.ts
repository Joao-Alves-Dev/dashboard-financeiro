import { describe, expect, it } from 'vitest'
import { configSchema, dispensarSchema } from './schemas'

const ok = (limiteCategoriaPct: string, altaPct: string, cartaoPct: string) =>
  configSchema.safeParse({ limiteCategoriaPct, altaPct, cartaoPct })

describe('configSchema', () => {
  it('aceita inteiros nas faixas e converte para número', () => {
    const r = ok('15', ' 30 ', '30')
    expect(r.success && r.data).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })
  })

  it('aceita os extremos: 1-100, 1-500, 1-100', () => {
    expect(ok('1', '1', '1').success).toBe(true)
    expect(ok('100', '500', '100').success).toBe(true)
  })

  it('rejeita fora da faixa', () => {
    expect(ok('0', '30', '30').success).toBe(false)
    expect(ok('101', '30', '30').success).toBe(false)
    expect(ok('15', '0', '30').success).toBe(false)
    expect(ok('15', '501', '30').success).toBe(false)
    expect(ok('15', '30', '0').success).toBe(false)
    expect(ok('15', '30', '101').success).toBe(false)
  })

  it('rejeita não inteiros, vazios, negativos e texto', () => {
    for (const v of ['', ' ', '1,5', '1.5', '-5', 'abc', '1e2', '０']) expect(ok(v, '30', '30').success, v).toBe(false)
  })

  it('o erro aponta o campo e usa chave de mensagem', () => {
    const r = ok('0', '30', '30')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['limiteCategoriaPct'])
      expect(r.error.issues[0].message).toMatch(/^orientador\.validacao\./)
    }
  })
})

describe('dispensarSchema', () => {
  it('aceita regra conhecida, chave e severidade', () => {
    expect(dispensarSchema.safeParse({ regraId: 'mes-negativo', chave: '', severidade: 'critico' }).success).toBe(true)
  })

  it('rejeita regra desconhecida, severidade inválida e chave longa', () => {
    expect(dispensarSchema.safeParse({ regraId: 'x', chave: '', severidade: 'critico' }).success).toBe(false)
    expect(dispensarSchema.safeParse({ regraId: 'mes-negativo', chave: '', severidade: 'grave' }).success).toBe(false)
    expect(dispensarSchema.safeParse({ regraId: 'mes-negativo', chave: 'a'.repeat(65), severidade: 'critico' }).success).toBe(false)
  })
})
