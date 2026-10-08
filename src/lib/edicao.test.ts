import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { obterEdicao, recursos } from './edicao'

describe('obterEdicao', () => {
  // sem argumento (ou undefined explícito) lê NEXT_PUBLIC_EDICAO; isola do ambiente da máquina
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_EDICAO', ''))
  afterEach(() => vi.unstubAllEnvs())

  it('sem argumento lê NEXT_PUBLIC_EDICAO', () => {
    vi.stubEnv('NEXT_PUBLIC_EDICAO', 'portfolio')
    expect(obterEdicao()).toBe('portfolio')
  })
  it('ausente cai em pessoal', () => {
    expect(obterEdicao(undefined)).toBe('pessoal')
  })
  it('valor inválido cai em pessoal', () => {
    expect(obterEdicao('xyz')).toBe('pessoal')
    expect(obterEdicao('')).toBe('pessoal')
  })
  it('valores válidos', () => {
    expect(obterEdicao('pessoal')).toBe('pessoal')
    expect(obterEdicao('portfolio')).toBe('portfolio')
  })
  it('normaliza espaços e maiúsculas', () => {
    expect(obterEdicao(' Portfolio ')).toBe('portfolio')
    expect(obterEdicao('PORTFOLIO')).toBe('portfolio')
    expect(obterEdicao(' PESSOAL\n')).toBe('pessoal')
  })
})

describe('recursos', () => {
  it('pessoal: sem demo e cadastro fechado', () => {
    expect(recursos('pessoal')).toEqual({ demo: false, cadastroAberto: false })
  })
  it('portfolio: demo e cadastro abertos', () => {
    expect(recursos('portfolio')).toEqual({ demo: true, cadastroAberto: true })
  })
})
