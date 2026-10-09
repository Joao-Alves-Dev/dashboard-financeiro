import { describe, expect, it } from 'vitest'
import { escolherContaPadrao, janelaCategoriasFrequentes, JANELA_DIAS } from './categorias-frequentes'

describe('janelaCategoriasFrequentes', () => {
  it('vai de hoje - 60 dias a hoje, inclusive', () => {
    expect(JANELA_DIAS).toBe(60)
    expect(janelaCategoriasFrequentes('2026-10-15')).toEqual({ de: '2026-08-16', ate: '2026-10-15' })
  })
  it('atravessa a virada de ano', () => {
    expect(janelaCategoriasFrequentes('2027-01-10')).toEqual({ de: '2026-11-11', ate: '2027-01-10' })
  })
  it('considera ano bissexto', () => {
    expect(janelaCategoriasFrequentes('2028-03-01')).toEqual({ de: '2028-01-01', ate: '2028-03-01' })
  })
})

describe('escolherContaPadrao', () => {
  const contas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('usa a conta do cookie quando ela existe no workspace', () => {
    expect(escolherContaPadrao(contas, 'b')).toBe('b')
  })
  it('cookie de conta que não é do workspace cai na primeira', () => {
    expect(escolherContaPadrao(contas, 'zzz')).toBe('a')
  })
  it('sem cookie usa a primeira', () => {
    expect(escolherContaPadrao(contas, undefined)).toBe('a')
  })
  it('sem contas devolve null', () => {
    expect(escolherContaPadrao([], 'a')).toBeNull()
  })
})
