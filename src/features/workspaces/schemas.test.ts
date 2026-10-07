import { describe, expect, it } from 'vitest'
import { novoWorkspaceSchema } from './schemas'

const chaves = (r: ReturnType<typeof novoWorkspaceSchema.safeParse>) =>
  r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`)

describe('novoWorkspaceSchema', () => {
  it('aceita nome válido e tipo pessoal/empresa; aplica trim', () => {
    expect(novoWorkspaceSchema.parse({ nome: '  Casa ', tipo: 'pessoal' })).toEqual({ nome: 'Casa', tipo: 'pessoal' })
    expect(novoWorkspaceSchema.safeParse({ nome: 'Padaria Bom Pão', tipo: 'empresa' }).success).toBe(true)
  })
  it('rejeita nome com menos de 2 caracteres (após trim)', () => {
    expect(chaves(novoWorkspaceSchema.safeParse({ nome: ' a ', tipo: 'pessoal' }))).toContain('nome:validacao.nomeCurto')
  })
  it('limites 2 e 60 caracteres', () => {
    expect(novoWorkspaceSchema.safeParse({ nome: 'ab', tipo: 'pessoal' }).success).toBe(true)
    expect(novoWorkspaceSchema.safeParse({ nome: 'x'.repeat(60), tipo: 'pessoal' }).success).toBe(true)
    expect(chaves(novoWorkspaceSchema.safeParse({ nome: 'x'.repeat(61), tipo: 'pessoal' }))).toContain('nome:validacao.nomeLongo')
  })
  it('rejeita tipo inválido ou ausente', () => {
    expect(chaves(novoWorkspaceSchema.safeParse({ nome: 'Casa', tipo: 'outro' }))).toContain('tipo:validacao.tipoInvalido')
    expect(novoWorkspaceSchema.safeParse({ nome: 'Casa', tipo: null }).success).toBe(false)
  })
})
