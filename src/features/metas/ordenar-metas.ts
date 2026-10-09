import type { SituacaoMeta } from './calcular-meta'

const RANK: Record<SituacaoMeta, number> = { vencida: 0, atrasada: 0, no_ritmo: 1, concluida: 2 }

/**
 * Ordem de urgência: vencidas e atrasadas primeiro, depois no ritmo, concluídas por último;
 * dentro de cada grupo, menor prazo primeiro e, no empate, pelo nome. Não altera a lista de entrada.
 */
export function ordenarPorUrgencia<T extends { nome: string; dataAlvo: string; calculo: { situacao: SituacaoMeta } }>(
  metas: T[],
): T[] {
  return [...metas].sort(
    (a, b) =>
      RANK[a.calculo.situacao] - RANK[b.calculo.situacao] ||
      (a.dataAlvo < b.dataAlvo ? -1 : a.dataAlvo > b.dataAlvo ? 1 : 0) ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}
