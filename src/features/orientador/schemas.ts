import { z } from 'zod'
import { REGRAS_IDS } from './regras'

// Mensagens são chaves de `messages/pt-BR.json`, traduzidas na action.

/** Inteiro em texto (como vem do campo do formulário) entre 1 e `max`. */
const pct = (max: number, chaveFaixa: string) =>
  z
    .string('orientador.validacao.inteiro')
    .trim()
    .regex(/^\d+$/, 'orientador.validacao.inteiro')
    .transform(Number)
    .refine((n) => n >= 1 && n <= max, chaveFaixa)

export const configSchema = z.object({
  limiteCategoriaPct: pct(100, 'orientador.validacao.faixa100'),
  altaPct: pct(500, 'orientador.validacao.faixa500'),
  cartaoPct: pct(100, 'orientador.validacao.faixa100'),
})

export type ConfigInput = z.output<typeof configSchema>

export const dispensarSchema = z.object({
  regraId: z.enum(REGRAS_IDS, 'orientador.erros.regraInvalida'),
  chave: z.string('orientador.erros.regraInvalida').max(64, 'orientador.erros.regraInvalida'),
  severidade: z.enum(['critico', 'atencao', 'info', 'positivo'], 'orientador.erros.regraInvalida'),
})

export type DispensarInput = z.output<typeof dispensarSchema>
