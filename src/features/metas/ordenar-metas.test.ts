import { describe, expect, it } from 'vitest'
import { ordenarPorUrgencia } from './ordenar-metas'
import type { SituacaoMeta } from './calcular-meta'

const m = (nome: string, situacao: SituacaoMeta, dataAlvo: string) => ({ nome, dataAlvo, calculo: { situacao } })

describe('ordenarPorUrgencia', () => {
  it('vencidas e atrasadas primeiro (por prazo), depois no ritmo, concluídas por último', () => {
    const lista = [
      m('concluida', 'concluida', '2026-01-01'),
      m('ritmo', 'no_ritmo', '2026-11-01'),
      m('atrasada tarde', 'atrasada', '2028-01-01'),
      m('vencida', 'vencida', '2026-05-01'),
      m('atrasada cedo', 'atrasada', '2027-01-01'),
    ]
    expect(ordenarPorUrgencia(lista).map((x) => x.nome)).toEqual([
      'vencida',
      'atrasada cedo',
      'atrasada tarde',
      'ritmo',
      'concluida',
    ])
  })
  it('empate de prazo desempata pelo nome e não altera a lista original', () => {
    const lista = [m('b', 'no_ritmo', '2027-01-01'), m('a', 'no_ritmo', '2027-01-01')]
    expect(ordenarPorUrgencia(lista).map((x) => x.nome)).toEqual(['a', 'b'])
    expect(lista.map((x) => x.nome)).toEqual(['b', 'a'])
  })
})
