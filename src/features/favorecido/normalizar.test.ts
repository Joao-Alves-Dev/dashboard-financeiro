import { describe, expect, it } from 'vitest'
import { limparFavorecido, normalizarFavorecido } from './normalizar'

describe('normalizarFavorecido', () => {
  it.each(['Jerônimo', 'jeronimo', '  Senhor   Jerônimo ', 'Sr. Jerônimo', 'seu Jerônimo'])('%j -> jeronimo', (nome) => {
    expect(normalizarFavorecido(nome)).toBe('jeronimo')
  })

  it('remove tratamento e acentos', () => {
    expect(normalizarFavorecido('Dona Maria José')).toBe('maria jose')
    expect(normalizarFavorecido('Sra. Dra. Ana')).toBe('ana')
    expect(normalizarFavorecido('DR. HOUSE')).toBe('house')
    expect(normalizarFavorecido('Doutora Lúcia')).toBe('lucia')
  })

  it('preserva partículas e tratamentos que não são os primeiros tokens', () => {
    expect(normalizarFavorecido('João da Silva')).toBe('joao da silva')
    expect(normalizarFavorecido('Zé do Sr. Silva')).toBe('ze do sr silva')
  })

  it('vazio ou só tratamento vira vazio', () => {
    expect(normalizarFavorecido('')).toBe('')
    expect(normalizarFavorecido('senhor')).toBe('')
    expect(normalizarFavorecido('Sr. Dr.')).toBe('')
  })

  it('tab e quebra de linha viram espaço', () => {
    expect(normalizarFavorecido('Senhor\tJerônimo\nSilva')).toBe('jeronimo silva')
  })

  it('pontuação (. ,) é removida', () => {
    expect(normalizarFavorecido('Silva, João')).toBe('silva joao')
  })
})

describe('limparFavorecido', () => {
  it('apara, colapsa espaços e mantém a grafia exibida (inclui tratamento)', () => {
    expect(limparFavorecido('  Senhor   Jerônimo ')).toEqual({ favorecido: 'Senhor Jerônimo', chave: 'jeronimo' })
    expect(limparFavorecido('Jerônimo')).toEqual({ favorecido: 'Jerônimo', chave: 'jeronimo' })
  })

  it('retorna null quando a chave fica vazia', () => {
    expect(limparFavorecido('')).toBeNull()
    expect(limparFavorecido('   ')).toBeNull()
    expect(limparFavorecido('Senhor')).toBeNull()
  })
})
