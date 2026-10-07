import { z } from 'zod'

// As mensagens são chaves de `messages/pt-BR.json` (namespace raiz), traduzidas na action.
export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('validacao.emailInvalido')),
  senha: z.string().min(1, 'validacao.senhaObrigatoria'),
})

export const cadastroSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'validacao.nomeCurto')
    .max(60, 'validacao.nomeLongo'),
  email: z.string().trim().pipe(z.email('validacao.emailInvalido')),
  senha: z
    .string()
    .min(8, 'validacao.senhaCurta')
    .max(128, 'validacao.senhaLonga'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CadastroInput = z.infer<typeof cadastroSchema>
