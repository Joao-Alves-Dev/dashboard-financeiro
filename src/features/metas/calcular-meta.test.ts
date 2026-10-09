import { describe, expect, it } from 'vitest'
import { calcularMeta, mesesAte } from './calcular-meta'

const base = { alvo: 1_000_000, guardado: 280_000, dataAlvo: '2027-09-30', hoje: '2026-10-15', sobraMedia: 60_000 }

describe('mesesAte', () => {
  it('conta o mês atual (2026-10-15 a 2027-09-30 = 12)', () => {
    expect(mesesAte('2026-10-15', '2027-09-30')).toBe(12)
  })
  it('mesmo mês = 1; mês passado = 1 (mínimo)', () => {
    expect(mesesAte('2026-10-15', '2026-10-31')).toBe(1)
    expect(mesesAte('2026-10-15', '2026-10-01')).toBe(1)
    expect(mesesAte('2026-10-15', '2025-01-01')).toBe(1)
  })
  it('virada de ano', () => {
    expect(mesesAte('2026-12-31', '2027-01-01')).toBe(2)
    expect(mesesAte('2026-01-01', '2026-12-31')).toBe(12)
  })
})

describe('calcularMeta', () => {
  it('exemplo do plano: 12 meses, faltam 720000, 60000 por mês', () => {
    const r = calcularMeta(base)
    expect(r.mesesRestantes).toBe(12)
    expect(r.faltam).toBe(720_000)
    expect(r.necessarioPorMes).toBe(60_000)
    expect(r.sobraMedia).toBe(60_000)
    expect(r.situacao).toBe('no_ritmo')
  })

  it('sobra média menor que o necessário = atrasada; igual ou maior = no ritmo', () => {
    expect(calcularMeta({ ...base, sobraMedia: 45_000 }).situacao).toBe('atrasada')
    expect(calcularMeta({ ...base, sobraMedia: 59_999 }).situacao).toBe('atrasada')
    expect(calcularMeta({ ...base, sobraMedia: 60_000 }).situacao).toBe('no_ritmo')
    expect(calcularMeta({ ...base, sobraMedia: 90_000 }).situacao).toBe('no_ritmo')
  })

  it('sobra média negativa ou zero = atrasada', () => {
    expect(calcularMeta({ ...base, sobraMedia: -10_000 }).situacao).toBe('atrasada')
    expect(calcularMeta({ ...base, sobraMedia: 0 }).situacao).toBe('atrasada')
  })

  it('guardado >= alvo = concluída, necessário 0, faltam nunca negativo', () => {
    const igual = calcularMeta({ ...base, guardado: 1_000_000 })
    expect(igual).toMatchObject({ situacao: 'concluida', necessarioPorMes: 0, faltam: 0 })
    const acima = calcularMeta({ ...base, guardado: 1_200_000, sobraMedia: -5 })
    expect(acima).toMatchObject({ situacao: 'concluida', necessarioPorMes: 0, faltam: 0 })
  })

  it('concluída mesmo com prazo vencido', () => {
    expect(calcularMeta({ ...base, guardado: 1_000_000, dataAlvo: '2025-01-01' }).situacao).toBe('concluida')
  })

  it('data alvo no passado e guardado < alvo = vencida, 1 mês, necessário = faltam', () => {
    const r = calcularMeta({ ...base, dataAlvo: '2026-09-30' })
    expect(r).toMatchObject({ situacao: 'vencida', mesesRestantes: 1, faltam: 720_000, necessarioPorMes: 720_000 })
  })

  it('vencida tem precedência sobre no ritmo (mesmo com sobra grande)', () => {
    expect(calcularMeta({ ...base, dataAlvo: '2026-10-14', sobraMedia: 99_999_999 }).situacao).toBe('vencida')
  })

  it('data alvo hoje ou depois no mês atual = 1 mês e não vencida', () => {
    expect(calcularMeta({ ...base, dataAlvo: '2026-10-15' })).toMatchObject({ mesesRestantes: 1, situacao: 'atrasada' })
    expect(calcularMeta({ ...base, dataAlvo: '2026-10-31', sobraMedia: 720_000 })).toMatchObject({
      mesesRestantes: 1,
      necessarioPorMes: 720_000,
      situacao: 'no_ritmo',
    })
  })

  it('necessário por mês arredonda para cima ao centavo', () => {
    const r = calcularMeta({ alvo: 100, guardado: 0, dataAlvo: '2026-12-31', hoje: '2026-10-01', sobraMedia: 0 })
    expect(r.mesesRestantes).toBe(3)
    expect(r.necessarioPorMes).toBe(34)
  })

  it('sobra média não é alterada', () => {
    expect(calcularMeta({ ...base, sobraMedia: -123 }).sobraMedia).toBe(-123)
  })

  it('guardado negativo (não deveria ocorrer) conta como faltam > alvo, sem quebrar', () => {
    expect(calcularMeta({ ...base, guardado: -100 }).faltam).toBe(1_000_100)
  })
})
