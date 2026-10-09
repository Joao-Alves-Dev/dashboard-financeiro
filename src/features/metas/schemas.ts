import { z } from 'zod'
import { normalizarDataBR } from '@/features/importacao/datas'
import { parseValorBR } from '@/lib/money'

// Mensagens são chaves de `messages/pt-BR.json`, traduzidas na action.

/** Teto do valor alvo/aporte: 100 bilhões de reais em centavos (bem abaixo de Number.MAX_SAFE_INTEGER). */
export const MAX_CENTAVOS = 10_000_000_000_000

const dataSchema = z
  .string('validacao.dataInvalida')
  .refine((v) => normalizarDataBR(v) !== null, 'validacao.dataInvalida')
  .transform((v) => normalizarDataBR(v) as string)

export const metaSchema = z
  .object({
    nome: z
      .string('metas.validacao.nomeObrigatorio')
      .trim()
      .min(1, 'metas.validacao.nomeObrigatorio')
      .max(80, 'metas.validacao.nomeLongo'),
    valorAlvo: z.string('validacao.valorInvalido').superRefine((v, ctx) => {
      const c = parseValorBR(v)
      if (c === null) ctx.addIssue({ code: 'custom', message: 'validacao.valorInvalido' })
      else if (c <= 0) ctx.addIssue({ code: 'custom', message: 'metas.validacao.valorAlvoPositivo' })
      else if (c > MAX_CENTAVOS) ctx.addIssue({ code: 'custom', message: 'metas.validacao.valorGrande' })
    }),
    dataAlvo: dataSchema,
  })
  .transform(({ valorAlvo, ...resto }) => ({ ...resto, valorAlvoCentavos: parseValorBR(valorAlvo) as number }))

export type MetaInput = z.output<typeof metaSchema>

export const aporteSchema = z
  .object({
    /** Positivo = aporte; negativo = retirada. */
    valor: z.string('validacao.valorInvalido').superRefine((v, ctx) => {
      const c = parseValorBR(v)
      if (c === null) ctx.addIssue({ code: 'custom', message: 'validacao.valorInvalido' })
      else if (c === 0) ctx.addIssue({ code: 'custom', message: 'validacao.valorZero' })
      else if (Math.abs(c) > MAX_CENTAVOS) ctx.addIssue({ code: 'custom', message: 'metas.validacao.valorGrande' })
    }),
    data: dataSchema,
    observacao: z
      .string()
      .trim()
      .max(200, 'metas.validacao.observacaoLonga')
      .nullish()
      .transform((v) => (v ? v : null)),
  })
  .transform(({ valor, ...resto }) => ({ ...resto, valorCentavos: parseValorBR(valor) as number }))

export type AporteInput = z.output<typeof aporteSchema>
