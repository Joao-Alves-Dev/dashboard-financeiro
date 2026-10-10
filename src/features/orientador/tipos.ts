import type { SituacaoMeta } from '@/features/metas/calcular-meta'

export type Severidade = 'critico' | 'atencao' | 'info' | 'positivo'

/**
 * Alerta devolvido por uma regra. `chave` identifica a INSTÂNCIA (id da categoria, id da meta; '' para
 * regras globais) e, junto com `regraId`, é o que "Dispensar" grava. `dicaId` aponta para a biblioteca.
 */
export type Alerta = {
  regraId: string
  chave: string
  severidade: Severidade
  titulo: string
  texto: string
  dicaId: string
}

/** Limites editáveis (percentuais inteiros). Padrões: 15, 30, 30. */
export type ConfigOrientador = {
  /** categoria-pct-renda: % máximo da renda em uma categoria. */
  limiteCategoriaPct: number
  /** categoria-alta: % acima da média dos 3 meses anteriores. */
  altaPct: number
  /** cartao-alto: % máximo da renda gasto em contas tipo cartão. */
  cartaoPct: number
}

export const CONFIG_PADRAO: ConfigOrientador = { limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 }

/** Todos os valores em centavos; datas 'YYYY-MM-DD'. */
export type ContextoFinanceiro = {
  hoje: string
  diaDoMes: number
  diasNoMes: number
  /** Entradas efetivadas do mês corrente. */
  rendaMes: number
  /** Saídas efetivadas do mês corrente (valor positivo). */
  saidasMes: number
  categorias: { id: string; nome: string; gastoMes: number; mediaTresMeses: number }[]
  /** Só categorias com orçamento no mês (orcado > 0). */
  orcamentos: { categoriaId: string; nome: string; orcado: number; realizado: number }[]
  metas: { id: string; nome: string; situacao: SituacaoMeta; necessarioPorMes: number; sobraMedia: number }[]
  /** Saídas efetivadas do mês em contas do tipo cartão. */
  gastoCartaoMes: number
  /** Resultado (entradas - saídas) de cada um dos 3 meses fechados anteriores. */
  resultadosTresMeses: number[]
}

export type Regra = (ctx: ContextoFinanceiro, cfg: ConfigOrientador) => Alerta[]

export type Dispensado = {
  regraId: string
  chave: string
  severidade: Severidade
  /** Dia 1 do mês em que foi dispensado. Se informado, só vale quando for o mês de `ctx.hoje`. */
  mes?: string
}

export const ORDEM_SEVERIDADE: Record<Severidade, number> = { critico: 3, atencao: 2, info: 1, positivo: 0 }

export type Tema = 'orcamento' | 'guardar' | 'dividas' | 'investir'

/** Temas na ordem de exibição. */
export const TEMAS: readonly Tema[] = ['orcamento', 'guardar', 'dividas', 'investir']

/** Texto da biblioteca "Aprenda". `corpo` é markdown mínimo (ver `renderizar-corpo.ts`). */
export type Dica = {
  id: string
  titulo: string
  tema: Tema
  resumo: string
  corpo: string
}
