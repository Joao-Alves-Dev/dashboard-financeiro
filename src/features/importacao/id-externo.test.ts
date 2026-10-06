import { describe, it, expect } from 'vitest'
import { atribuirIdsExternos } from './id-externo'
import type { LinhaImportada } from './tipos'

const cafe = (linha: number): LinhaImportada => ({
  linha,
  data: '2026-03-15',
  descricao: 'CAFE DA ESQUINA',
  valorCentavos: -500,
})

describe('atribuirIdsExternos', () => {
  it('mantém o idExterno vindo do OFX', () => {
    const r = atribuirIdsExternos([{ ...cafe(1), idExterno: 'FIT123' }])
    expect(r[0].idExterno).toBe('FIT123')
  })

  it('duas transações idênticas no mesmo dia recebem ids diferentes', () => {
    const r = atribuirIdsExternos([cafe(1), cafe(2)])
    expect(r[0].idExterno).not.toBe(r[1].idExterno)
    expect(r[0].idExterno).toMatch(/^csv:[0-9a-f]{64}$/)
  })

  it('reprocessar o mesmo conteúdo gera os mesmos ids', () => {
    const a = atribuirIdsExternos([cafe(1), cafe(2)])
    const b = atribuirIdsExternos([cafe(1), cafe(2)])
    expect(b.map((l) => l.idExterno)).toEqual(a.map((l) => l.idExterno))
  })

  it('o id não depende do número da linha no arquivo', () => {
    const a = atribuirIdsExternos([cafe(2)])
    const b = atribuirIdsExternos([cafe(40)])
    expect(a[0].idExterno).toBe(b[0].idExterno)
  })

  it('descrição é normalizada (trim, maiúsculas, espaços colapsados)', () => {
    const a = atribuirIdsExternos([{ ...cafe(1), descricao: '  café   da esquina ' }])
    const b = atribuirIdsExternos([{ ...cafe(1), descricao: 'CAFÉ DA ESQUINA' }])
    expect(a[0].idExterno).toBe(b[0].idExterno)
  })

  it('data ou valor diferentes geram ids diferentes', () => {
    const r = atribuirIdsExternos([
      cafe(1),
      { ...cafe(2), data: '2026-03-16' },
      { ...cafe(3), valorCentavos: -501 },
    ])
    expect(new Set(r.map((l) => l.idExterno)).size).toBe(3)
  })

  it('o índice de ocorrência conta só linhas idênticas; linha com idExterno não conta', () => {
    const solo = atribuirIdsExternos([cafe(1)])
    const misto = atribuirIdsExternos([{ ...cafe(1), idExterno: 'X' }, cafe(2)])
    expect(misto[1].idExterno).toBe(solo[0].idExterno)
  })

  it('preserva os demais campos e a ordem', () => {
    const r = atribuirIdsExternos([cafe(1), { ...cafe(2), descricao: 'OUTRA' }])
    expect(r.map((l) => l.linha)).toEqual([1, 2])
    expect(r[1].descricao).toBe('OUTRA')
  })
})
