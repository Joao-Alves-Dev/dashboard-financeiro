import { describe, expect, it } from 'vitest'
import { sugerirFavorecidos } from './sugerir-favorecidos'

const existentes = [
  { chave: 'jeova', nome: 'Jeová' },
  { chave: 'jose', nome: 'José' },
  { chave: 'maria silva', nome: 'Maria Silva' },
]

describe('sugerirFavorecidos', () => {
  it('acha o nome exato primeiro, ignorando acento, caixa e tratamento', () => {
    expect(sugerirFavorecidos('jeova', existentes)[0].nome).toBe('Jeová')
    expect(sugerirFavorecidos('Senhor JEOVÁ', existentes)[0].nome).toBe('Jeová')
  })

  it("'jeovah' (distância 1) sugere Jeová", () => {
    expect(sugerirFavorecidos('jeovah', existentes).map((s) => s.nome)).toEqual(['Jeová'])
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
