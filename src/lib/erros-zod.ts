import type { z } from 'zod'

/** Primeiro erro de cada campo, com a mensagem (chave) passada por `traduzir`. */
export function errosPorCampo(
  erro: z.ZodError,
  traduzir: (chave: string) => string,
): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const issue of erro.issues) {
    const campo = String(issue.path[0] ?? '_')
    if (!(campo in campos)) campos[campo] = traduzir(issue.message)
  }
  return campos
}
