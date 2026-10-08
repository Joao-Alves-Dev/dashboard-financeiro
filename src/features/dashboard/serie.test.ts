import { describe, expect, it } from 'vitest'
import { paraSerieGrafico, temMovimento, type LinhaResumoMensal } from './serie'

const l = (mes: string, entradas: number, saidas: number): LinhaResumoMensal => ({
  mes,
  entradas,
  saidas,
  resultado: entradas - saidas,
})

describe('paraSerieGrafico', () => {
  it('mantém centavos, ordena por mês e rotula; ano só no 1º ponto e em janeiro', () => {
    const s = paraSerieGrafico([l('2027-01-01', 10, 5), l('2026-11-01', 7, 0), l('2026-12-01', 0, 0)])
    expect(s.map((p) => p.mes)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
    expect(s.map((p) => p.rotulo)).toEqual(['nov/26', 'dez', 'jan/27'])
    expect(s[0]).toMatchObject({ entradas: 7, saidas: 0, resultado: 7, rotuloLongo: 'novembro de 2026' })
    expect(s[2]).toMatchObject({ entradas: 10, saidas: 5, resultado: 5 })
  })
  it('lista vazia', () => {
    expect(paraSerieGrafico([])).toEqual([])
  })
  it('temMovimento é falso quando todo o período é zero', () => {
    expect(temMovimento(paraSerieGrafico([l('2026-11-01', 0, 0)]))).toBe(false)
    expect(temMovimento(paraSerieGrafico([l('2026-11-01', 0, 1)]))).toBe(true)
  })
})
