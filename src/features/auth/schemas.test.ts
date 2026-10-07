import { describe, expect, it } from 'vitest'
import { cadastroSchema, loginSchema } from './schemas'

const chaves = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${String(i.path[0])}:${i.message}`)

describe('cadastroSchema', () => {
  const ok = { nome: 'Maria', email: 'maria@exemplo.com', senha: '12345678' }
  it('aceita dados válidos e normaliza e-mail/nome com trim', () => {
    expect(cadastroSchema.parse({ ...ok, nome: ' Maria ', email: ' maria@exemplo.com ' })).toEqual(ok)
  })
  it('senha precisa de pelo menos 8 caracteres', () => {
    expect(chaves(cadastroSchema.safeParse({ ...ok, senha: '1234567' }))).toContain('senha:validacao.senhaCurta')
    expect(cadastroSchema.safeParse({ ...ok, senha: '12345678' }).success).toBe(true)
  })
  it('rejeita e-mail inválido e nome curto', () => {
    expect(chaves(cadastroSchema.safeParse({ ...ok, email: 'maria' }))).toContain('email:validacao.emailInvalido')
    expect(chaves(cadastroSchema.safeParse({ ...ok, nome: 'M' }))).toContain('nome:validacao.nomeCurto')
  })
})

describe('loginSchema', () => {
  it('exige e-mail válido e senha preenchida', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', senha: 'x' }).success).toBe(true)
    expect(chaves(loginSchema.safeParse({ email: 'x', senha: '' }))).toEqual(
      expect.arrayContaining(['email:validacao.emailInvalido', 'senha:validacao.senhaObrigatoria']),
    )
  })
})
