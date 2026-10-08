import { describe, expect, it } from 'vitest'
import { FUSO_NEGOCIO, hojeISO } from './hoje'

describe('hojeISO (America/Sao_Paulo)', () => {
  it('usa o fuso de São Paulo, não o do servidor/UTC', () => {
    expect(FUSO_NEGOCIO).toBe('America/Sao_Paulo')
    // 01:30 UTC de 08/10 = 22:30 de 07/10 em Brasília
    expect(hojeISO(new Date('2026-10-08T01:30:00Z'))).toBe('2026-10-07')
    // 03:00 UTC = 00:00 em Brasília: já é o dia seguinte
    expect(hojeISO(new Date('2026-10-08T03:00:00Z'))).toBe('2026-10-08')
  })
  it('vira o ano corretamente', () => {
    expect(hojeISO(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31')
    expect(hojeISO(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01')
  })
  it('sem argumento devolve YYYY-MM-DD', () => {
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
