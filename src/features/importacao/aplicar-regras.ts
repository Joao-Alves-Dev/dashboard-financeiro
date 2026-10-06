export type Regra = { padrao: string; categoriaId: string; prioridade: number }

/**
 * Categoriza por regra "contém", sem diferenciar maiúsculas. Entre as regras que casam
 * vence a de maior prioridade (empate: a primeira da lista). Padrão vazio é ignorado.
 */
export function aplicarRegras<T extends { descricao: string }>(
  linhas: T[],
  regras: Regra[],
): (T & { categoriaId: string | null })[] {
  const ativas = regras
    .map((r) => ({ ...r, chave: r.padrao.trim().toLowerCase() }))
    .filter((r) => r.chave !== '')
  return linhas.map((l) => {
    const desc = l.descricao.toLowerCase()
    let melhor: (typeof ativas)[number] | null = null
    for (const r of ativas) {
      if (desc.includes(r.chave) && (melhor === null || r.prioridade > melhor.prioridade)) {
        melhor = r
      }
    }
    return { ...l, categoriaId: melhor ? melhor.categoriaId : null }
  })
}
