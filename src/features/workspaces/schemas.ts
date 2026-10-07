import { z } from 'zod'

export const TIPOS_WORKSPACE = ['pessoal', 'empresa'] as const

// Mensagens são chaves de `messages/pt-BR.json`, traduzidas na action.
export const novoWorkspaceSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'validacao.nomeCurto')
    .max(60, 'validacao.nomeLongo'),
  tipo: z.enum(TIPOS_WORKSPACE, 'validacao.tipoInvalido'),
})

export type NovoWorkspaceInput = z.infer<typeof novoWorkspaceSchema>
