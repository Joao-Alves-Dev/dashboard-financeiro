import { describe, expect, it } from 'vitest'
import { categoriaSchema, contaSchema, regraSchema } from './schemas'

const CAT = '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const chaves = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${String(i.path[0])}:${i.message}`)

describe('contaSchema', () => {
  it('converte saldo inicial BR para centavos (vazio = 0, negativo aceito)', () => {
    const a = contaSchema.parse({ nome: ' Nubank ', tipo: 'corrente', saldoInicial: '1.234,56' })
    expect(a).toEqual({ nome: 'Nubank', tipo: 'corrente', saldoInicialCentavos: 123456 })
    expect(contaSchema.parse({ nome: 'x', tipo: 'dinheiro', saldoInicial: '' }).saldoInicialCentavos).toBe(0)
    expect(contaSchema.parse({ nome: 'x', tipo: 'cartao', saldoInicial: '-50,00' }).saldoInicialCentavos).toBe(-5000)
  })
  it('rejeita nome vazio, tipo e saldo inválidos', () => {
    expect(chaves(contaSchema.safeParse({ nome: ' ', tipo: 'corrente', saldoInicial: '0' }))).toContain('nome:validacao.nomeObrigatorio')
    expect(chaves(contaSchema.safeParse({ nome: 'a', tipo: 'poupanca', saldoInicial: '0' }))).toContain('tipo:validacao.tipoContaInvalido')
    expect(chaves(contaSchema.safeParse({ nome: 'a', tipo: 'corrente', saldoInicial: 'abc' }))).toContain('saldoInicial:validacao.valorInvalido')
  })
})

describe('categoriaSchema', () => {
  it('aceita cor hex; padrão quando ausente; rejeita natureza/cor inválidas', () => {
    expect(categoriaSchema.parse({ nome: 'Pet', natureza: 'despesa', cor: '#AABBCC' }).cor).toBe('#AABBCC')
    expect(categoriaSchema.parse({ nome: 'Pet', natureza: 'despesa' }).cor).toBe('#64748b')
    expect(chaves(categoriaSchema.safeParse({ nome: 'Pet', natureza: 'x' }))).toContain('natureza:validacao.naturezaInvalida')
    expect(chaves(categoriaSchema.safeParse({ nome: 'Pet', natureza: 'receita', cor: 'vermelho' }))).toContain('cor:validacao.corInvalida')
  })
})

describe('regraSchema', () => {
  it('padrão aparado, prioridade numérica a partir de texto', () => {
    expect(regraSchema.parse({ padrao: '  uber ', categoriaId: CAT, prioridade: '5' })).toEqual({
      padrao: 'uber',
      categoriaId: CAT,
      prioridade: 5,
    })
    expect(regraSchema.parse({ padrao: 'uber', categoriaId: CAT, prioridade: '' }).prioridade).toBe(0)
  })
  it('rejeita padrão vazio, categoria inválida e prioridade não inteira', () => {
    expect(chaves(regraSchema.safeParse({ padrao: ' ', categoriaId: CAT }))).toContain('padrao:validacao.padraoObrigatorio')
    expect(chaves(regraSchema.safeParse({ padrao: 'a', categoriaId: 'x' }))).toContain('categoriaId:validacao.categoriaObrigatoria')
    expect(chaves(regraSchema.safeParse({ padrao: 'a', categoriaId: CAT, prioridade: '1.5' }))).toContain('prioridade:validacao.prioridadeInvalida')
  })
})
