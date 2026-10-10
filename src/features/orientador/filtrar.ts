import type { Tema } from './tipos'

/** Dado enviado ao cliente: só metadados (o corpo de cada dica é carregado na página da dica). */
export type DicaResumo = { id: string; titulo: string; tema: Tema; resumo: string }

/** Minúsculas e sem acentos (NFD sem marcas combinantes), para comparar "cartão" com "cartao". */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Busca no cliente sobre a lista já carregada: cada palavra do termo precisa aparecer no título ou no resumo
 * (substring, sem acentos nem maiúsculas). Termo vazio devolve tudo. Não usa regex com o termo digitado.
 */
export function filtrarDicas(dicas: DicaResumo[], termo: string): DicaResumo[] {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return dicas
  return dicas.filter((d) => {
    const alvo = normalizar(`${d.titulo} ${d.resumo}`)
    return palavras.every((p) => alvo.includes(p))
  })
}

export function agruparPorTema(
  dicas: DicaResumo[],
  temas: readonly Tema[],
): { tema: Tema; dicas: DicaResumo[] }[] {
  return temas
    .map((tema) => ({ tema, dicas: dicas.filter((d) => d.tema === tema) }))
    .filter((g) => g.dicas.length > 0)
}
