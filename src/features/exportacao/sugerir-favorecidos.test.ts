import { describe, expect, it } from 'vitest'
import { sugerirFavorecidos } from './sugerir-favorecidos'

const existentes = [
  { chave: 'jeronimo', nome: 'Jerônimo' },
  { chave: 'jose', nome: 'José' },
  { chave: 'maria silva', nome: 'Maria Silva' },
]

describe('sugerirFavorecidos', () => {
  it('acha o nome exato primeiro, ignorando acento, caixa e tratamento', () => {
    expect(sugerirFavorecidos('jeronimo', existentes)[0].nome).toBe('Jerônimo')
    expect(sugerirFavorecidos('Senhor JERÔNIMO', existentes)[0].nome).toBe('Jerônimo')
  })

  it("'jeronimoh' (distância 1) sugere Jerônimo", () => {
    expect(sugerirFavorecidos('jeronimoh', existentes).map((s) => s.nome)).toEqual(['Jerônimo'])
  })

  it('nome sem parecido devolve vazio', () => {
    expect(sugerirFavorecidos('xyzwq', existentes)).toEqual([])
    expect(sugerirFavorecidos('', existentes)).toEqual([])
  })

  it('casa por pedaço do nome ("maria" acha "Maria Silva") e erro em uma palavra', () => {
    expect(sugerirFavorecidos('maria', existentes)[0].nome).toBe('Maria Silva')
    expect(sugerirFavorecidos('silvaa', existentes)[0].nome).toBe('Maria Silva')
  })

  it('respeita o limite', () => {
    const muitos = ['joao', 'joai', 'joas', 'joap'].map((c) => ({ chave: c, nome: c }))
    expect(sugerirFavorecidos('joao', muitos, 2)).toHaveLength(2)
  })
})
