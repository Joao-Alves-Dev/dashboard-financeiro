import { describe, expect, it } from 'vitest'
import { aporteSchema, metaSchema } from './schemas'

const chaves = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => `${String(i.path[0])}:${i.message}`)

describe('metaSchema', () => {
  it('converte nome aparado, valor BR em centavos e data (dd/mm/aaaa ou ISO)', () => {
    expect(metaSchema.parse({ nome: '  Reserva de emergência ', valorAlvo: '10.000,00', dataAlvo: '2027-09-30' })).toEqual({
      nome: 'Reserva de emergência',
      valorAlvoCentavos: 1_000_000,
      dataAlvo: '2027-09-30',
    })
    expect(metaSchema.parse({ nome: 'Viagem', valorAlvo: '500', dataAlvo: '31/12/2026' }).dataAlvo).toBe('2026-12-31')
  })
  it('nome de 1 a 80 caracteres', () => {
    expect(chaves(metaSchema.safeParse({ nome: '   ', valorAlvo: '1', dataAlvo: '2027-01-01' }))).toContain('nome:metas.validacao.nomeObrigatorio')
    expect(chaves(metaSchema.safeParse({ nome: 'a'.repeat(81), valorAlvo: '1', dataAlvo: '2027-01-01' }))).toContain('nome:metas.validacao.nomeLongo')
    expect(metaSchema.safeParse({ nome: 'a'.repeat(80), valorAlvo: '1', dataAlvo: '2027-01-01' }).success).toBe(true)
  })
  it('valor alvo precisa ser > 0 e válido', () => {
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: '0', dataAlvo: '2027-01-01' }))).toContain('valorAlvo:metas.validacao.valorAlvoPositivo')
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: '-10', dataAlvo: '2027-01-01' }))).toContain('valorAlvo:metas.validacao.valorAlvoPositivo')
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: 'abc', dataAlvo: '2027-01-01' }))).toContain('valorAlvo:validacao.valorInvalido')
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: '999.999.999.999,99', dataAlvo: '2027-01-01' }))).toContain('valorAlvo:metas.validacao.valorGrande')
  })
  it('data alvo inválida é rejeitada', () => {
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: '1', dataAlvo: '2027-02-30' }))).toContain('dataAlvo:validacao.dataInvalida')
    expect(chaves(metaSchema.safeParse({ nome: 'a', valorAlvo: '1' }))).toContain('dataAlvo:validacao.dataInvalida')
  })
})

describe('aporteSchema', () => {
  it('aporte positivo, retirada negativa, observação aparada ou nula', () => {
    expect(aporteSchema.parse({ valor: '1.500,50', data: '2026-10-15', observacao: ' 13º ' })).toEqual({
      valorCentavos: 150_050,
      data: '2026-10-15',
      observacao: '13º',
    })
    expect(aporteSchema.parse({ valor: '-200', data: '2026-10-15' })).toEqual({ valorCentavos: -20_000, data: '2026-10-15', observacao: null })
    expect(aporteSchema.parse({ valor: '10', data: '2026-10-15', observacao: '   ' }).observacao).toBeNull()
  })
  it('rejeita zero, inválido, data inválida e observação > 200', () => {
    expect(chaves(aporteSchema.safeParse({ valor: '0', data: '2026-10-15' }))).toContain('valor:validacao.valorZero')
    expect(chaves(aporteSchema.safeParse({ valor: '0,00', data: '2026-10-15' }))).toContain('valor:validacao.valorZero')
    expect(chaves(aporteSchema.safeParse({ valor: 'x', data: '2026-10-15' }))).toContain('valor:validacao.valorInvalido')
    expect(chaves(aporteSchema.safeParse({ valor: '1', data: '2026-13-01' }))).toContain('data:validacao.dataInvalida')
    expect(chaves(aporteSchema.safeParse({ valor: '1', data: '2026-10-15', observacao: 'a'.repeat(201) }))).toContain('observacao:metas.validacao.observacaoLonga')
    expect(aporteSchema.safeParse({ valor: '1', data: '2026-10-15', observacao: 'a'.repeat(200) }).success).toBe(true)
  })
})
