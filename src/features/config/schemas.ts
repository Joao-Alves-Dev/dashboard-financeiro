import { z } from 'zod'
import { parseValorBR } from '@/lib/money'
import { ehUuid } from '@/lib/uuid'

export const TIPOS_CONTA = ['corrente', 'cartao', 'dinheiro'] as const
export const NATUREZAS = ['receita', 'despesa'] as const

// Mensagens são chaves de `messages/pt-BR.json`, traduzidas na action.

const nome = z
  .string('validacao.nomeObrigatorio')
  .trim()
  .min(1, 'validacao.nomeObrigatorio')
  .max(60, 'validacao.nomeLongo')

export const contaSchema = z
  .object({
    nome,
    tipo: z.enum(TIPOS_CONTA, 'validacao.tipoContaInvalido'),
    saldoInicial: z
      .string()
      .nullish()
      .superRefine((v, ctx) => {
        if (v != null && v.trim() !== '' && parseValorBR(v) === null) {
          ctx.addIssue({ code: 'custom', message: 'validacao.valorInvalido' })
        }
      }),
  })
  .transform(({ saldoInicial, ...resto }) => ({
    ...resto,
    saldoInicialCentavos: saldoInicial && saldoInicial.trim() !== '' ? (parseValorBR(saldoInicial) as number) : 0,
  }))

export type ContaInput = z.output<typeof contaSchema>

export const categoriaSchema = z.object({
  nome,
  natureza: z.enum(NATUREZAS, 'validacao.naturezaInvalida'),
  cor: z
    .string()
    .nullish()
    .refine((v) => v == null || v === '' || /^#[0-9a-f]{6}$/i.test(v), 'validacao.corInvalida')
    .transform((v) => (v ? v : '#64748b')),
})

export type CategoriaInput = z.output<typeof categoriaSchema>

export const regraSchema = z.object({
  padrao: z
    .string('validacao.padraoObrigatorio')
    .trim()
    .min(1, 'validacao.padraoObrigatorio')
    .max(100, 'validacao.padraoLongo'),
  categoriaId: z.string('validacao.categoriaObrigatoria').refine(ehUuid, 'validacao.categoriaObrigatoria'),
  prioridade: z
    .string()
    .nullish()
    .refine((v) => v == null || v.trim() === '' || /^-?\d{1,4}$/.test(v.trim()), 'validacao.prioridadeInvalida')
    .transform((v) => (v == null || v.trim() === '' ? 0 : Number(v.trim()))),
})

export type RegraInput = z.output<typeof regraSchema>
