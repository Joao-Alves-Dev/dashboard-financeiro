import { rotuloMesCurto, rotuloMesLongo } from './periodo'

export type LinhaResumoMensal = { mes: string; entradas: number; saidas: number; resultado: number }
export type PontoSerie = LinhaResumoMensal & { rotulo: string; rotuloLongo: string }

/**
 * Série para o gráfico: ordena por mês, mantém centavos. O rótulo do eixo leva o ano só no
 * primeiro ponto e em janeiro (12 rótulos com ano não cabem em 375px).
 */
export function paraSerieGrafico(linhas: LinhaResumoMensal[]): PontoSerie[] {
  return [...linhas]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((l, i) => ({
      ...l,
      rotulo: rotuloMesCurto(l.mes, i === 0 || l.mes.slice(5, 7) === '01'),
      rotuloLongo: rotuloMesLongo(l.mes),
    }))
}

export function temMovimento(serie: PontoSerie[]): boolean {
  return serie.some((p) => p.entradas !== 0 || p.saidas !== 0)
}
