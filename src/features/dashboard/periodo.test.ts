import { describe, expect, it } from 'vitest'
import {
  inicioDoMes,
  intervaloUltimosMeses,
  mesAnterior,
  rotuloMesCurto,
  rotuloMesLongo,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from './periodo'

describe('periodo (aritmética de string)', () => {
  it('inicioDoMes / ultimoDiaDoMes', () => {
    expect(inicioDoMes('2026-10-07')).toBe('2026-10-01')
    expect(ultimoDiaDoMes('2026-02-10')).toBe('2026-02-28')
    expect(ultimoDiaDoMes('2028-02-10')).toBe('2028-02-29')
    expect(ultimoDiaDoMes('2026-12-31')).toBe('2026-12-31')
  })
  it('somarMeses atravessa o ano', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01')
    expect(somarMeses('2027-01-01', -1)).toBe('2026-12-01')
    expect(somarMeses('2026-10-15', -11)).toBe('2025-11-01')
    expect(mesAnterior('2026-01-20')).toBe('2025-12-01')
  })
  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(somarDias('2026-10-07', 30)).toBe('2026-11-06')
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('intervaloUltimosMeses(12) vai do 1º dia 11 meses atrás ao último dia do mês atual', () => {
    expect(intervaloUltimosMeses('2026-10-07', 12)).toEqual({ de: '2025-11-01', ate: '2026-10-31' })
    expect(intervaloUltimosMeses('2027-01-01', 12)).toEqual({ de: '2026-02-01', ate: '2027-01-31' })
  })
  it('rótulos', () => {
    expect(rotuloMesCurto('2026-12-01', false)).toBe('dez')
    expect(rotuloMesCurto('2027-01-01', true)).toBe('jan/27')
    expect(rotuloMesLongo('2026-12-01')).toBe('dezembro de 2026')
  })
})
