import { describe, expect, it } from 'vitest'
import { dataPorExtenso, diaMesParaData, numeroDoMes, somarDias } from './datas-fala'

describe('somarDias', () => {
  it('atravessa mês e ano sem fuso', () => {
    expect(somarDias('2026-10-15', -1)).toBe('2026-10-14')
    expect(somarDias('2026-10-01', -1)).toBe('2026-09-30')
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(somarDias('2025-12-31', 1)).toBe('2026-01-01')
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29')
    expect(somarDias('2026-10-08', -2)).toBe('2026-10-06')
    expect(somarDias('2026-10-08', 0)).toBe('2026-10-08')
  })
})

describe('numeroDoMes', () => {
  it('casa nomes com e sem acento', () => {
    expect(numeroDoMes('setembro')).toBe(9)
    expect(numeroDoMes('março')).toBe(3)
    expect(numeroDoMes('marco')).toBe(3)
    expect(numeroDoMes('Dezembro')).toBe(12)
    expect(numeroDoMes('banana')).toBeNull()
  })
})

describe('diaMesParaData', () => {
  const hoje = '2026-10-15'
  it('dia sem mês: dia passado/atual no mês corrente', () => {
    expect(diaMesParaData(3, null, null, hoje)).toBe('2026-10-03')
    expect(diaMesParaData(15, null, null, hoje)).toBe('2026-10-15')
  })
  it('dia sem mês: dia futuro cai no mês anterior', () => {
    expect(diaMesParaData(20, null, null, hoje)).toBe('2026-09-20')
    expect(diaMesParaData(3, null, null, '2026-10-02')).toBe('2026-09-03')
    expect(diaMesParaData(20, null, null, '2026-01-10')).toBe('2025-12-20')
  })
  it('dia sem mês: volta até um mês em que o dia exista', () => {
    // hoje 1º de março: dia 31 não existe em fevereiro; o mais recente é 31 de janeiro
    expect(diaMesParaData(31, null, null, '2026-03-01')).toBe('2026-01-31')
  })
  it('mês sem ano: ano atual; no futuro, ano anterior', () => {
    expect(diaMesParaData(29, 9, null, '2026-10-08')).toBe('2026-09-29')
    expect(diaMesParaData(5, 10, null, hoje)).toBe('2026-10-05')
    expect(diaMesParaData(10, 12, null, hoje)).toBe('2025-12-10')
    expect(diaMesParaData(16, 10, null, hoje)).toBe('2025-10-16')
  })
  it('ano explícito é respeitado', () => {
    expect(diaMesParaData(10, 12, 2027, hoje)).toBe('2027-12-10')
  })
  it('data inexistente -> null', () => {
    expect(diaMesParaData(31, 2, null, hoje)).toBeNull()
    expect(diaMesParaData(0, null, null, hoje)).toBeNull()
    expect(diaMesParaData(32, null, null, hoje)).toBeNull()
  })
})

describe('dataPorExtenso', () => {
  it('hoje, ontem, anteontem e demais datas', () => {
    expect(dataPorExtenso('2026-10-08', '2026-10-08')).toBe('hoje, 8 de outubro')
    expect(dataPorExtenso('2026-10-07', '2026-10-08')).toBe('ontem, 7 de outubro')
    expect(dataPorExtenso('2026-10-06', '2026-10-08')).toBe('anteontem, 6 de outubro')
    expect(dataPorExtenso('2026-09-29', '2026-10-08')).toBe('29 de setembro')
    expect(dataPorExtenso('2025-12-10', '2026-10-08')).toBe('10 de dezembro de 2025')
    expect(dataPorExtenso('2026-10-01', '2026-10-08')).toBe('1º de outubro')
  })
})
