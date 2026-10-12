import { z } from 'zod'
import { FAVORECIDO_MAX } from '@/features/favorecido/normalizar'
import { normalizarDataBR } from '@/features/importacao/datas'

const data = z
  .string('validacao.dataInvalida')
  .refine((v) => normalizarDataBR(v) !== null, 'validacao.dataInvalida')
  .transform((v) => normalizarDataBR(v) as string)

export const TIPOS_EXPORTACAO = ['saidas', 'entradas', 'todas'] as const

/** Entrada da action de exportação. Mensagens são chaves de `messages/pt-BR.json`. */
export const exportacaoSchema = z
  .object({
    favorecido: z.string().max(FAVORECIDO_MAX, 'validacao.favorecidoLongo').default(''),
    de: data,
    ate: data,
    tipo: z.enum(TIPOS_EXPORTACAO, 'validacao.tipoLancamentoInvalido').default('saidas'),
    /** Sem período: o servidor não filtra por data (de/ate ainda precisam ser datas válidas, ex.: `PERIODO_TUDO`). */
    todoPeriodo: z.boolean().default(false),
  })
  .refine((v) => v.de <= v.ate, { message: 'exportacao.periodoInvertido', path: ['ate'] })

export type ExportacaoInput = z.input<typeof exportacaoSchema>

type SearchParams = Record<string, string | string[] | undefined>
const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

export type ParamsTela = {
  favorecido: string
  nome: string
  de: string
  ate: string
  tipo: (typeof TIPOS_EXPORTACAO)[number]
  total: boolean
  /** Padrão 'branco': a coluna Anotações sai vazia, como no layout de referência. */
  anotacoes: 'descricao' | 'branco'
  /** Todo o período (sem filtro de data). */
  todo: boolean
}

/** Lê os parâmetros da tela de exportação da URL; inválidos são descartados em silêncio. */
export function lerParamsTela(sp: SearchParams, hoje: string, inicioMes: string): ParamsTela {
  const de = normalizarDataBR(primeiro(sp.de) ?? '') ?? inicioMes
  const ate = normalizarDataBR(primeiro(sp.ate) ?? '') ?? hoje
  const tipo = primeiro(sp.tipo)
  return {
    favorecido: (primeiro(sp.favorecido) ?? '').trim().slice(0, FAVORECIDO_MAX),
    nome: (primeiro(sp.nome) ?? '').trim().slice(0, FAVORECIDO_MAX),
    de: de <= ate ? de : ate,
    ate: de <= ate ? ate : de,
    tipo: TIPOS_EXPORTACAO.find((t) => t === tipo) ?? 'saidas',
    total: primeiro(sp.total) === '1',
    anotacoes: primeiro(sp.anotacoes) === 'descricao' ? 'descricao' : 'branco',
    todo: primeiro(sp.todo) === '1',
  }
}
