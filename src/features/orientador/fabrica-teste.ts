import { CONFIG_PADRAO, type ConfigOrientador, type ContextoFinanceiro } from './tipos'

/** Só para testes: contexto neutro (dia 15 de 30, tudo zerado) com sobrescritas. */
export function ctx(sobre: Partial<ContextoFinanceiro> = {}): ContextoFinanceiro {
  return {
    hoje: '2026-09-15',
    diaDoMes: 15,
    diasNoMes: 30,
    rendaMes: 0,
    saidasMes: 0,
    categorias: [],
    orcamentos: [],
    metas: [],
    gastoCartaoMes: 0,
    resultadosTresMeses: [],
    ...sobre,
  }
}

export function cfg(sobre: Partial<ConfigOrientador> = {}): ConfigOrientador {
  return { ...CONFIG_PADRAO, ...sobre }
}
