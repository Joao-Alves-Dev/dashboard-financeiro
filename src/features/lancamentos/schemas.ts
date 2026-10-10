import { z } from 'zod'
import { FAVORECIDO_MAX, limparFavorecido } from '@/features/favorecido/normalizar'
import { normalizarDataBR } from '@/features/importacao/datas'
import { parseValorBR } from '@/lib/money'
import { ehUuid } from '@/lib/uuid'

export const TIPOS_LANCAMENTO = ['entrada', 'saida'] as const
export const STATUS_LANCAMENTO = ['efetivado', 'pendente'] as const

// Mensagens são chaves de `messages/pt-BR.json`, traduzidas na action.

const dataSchema = z
  .string('validacao.dataInvalida')
  .refine((v) => normalizarDataBR(v) !== null, 'validacao.dataInvalida')
  .transform((v) => normalizarDataBR(v) as string)

/** Valor digitado (positivo, formato BR); o sinal vem do tipo. Zero e texto inválido são rejeitados. */
const valorSchema = z
  .string('validacao.valorInvalido')
  .superRefine((v, ctx) => {
    const c = parseValorBR(v)
    if (c === null) ctx.addIssue({ code: 'custom', message: 'validacao.valorInvalido' })
    else if (c === 0) ctx.addIssue({ code: 'custom', message: 'validacao.valorZero' })
  })

const uuidObrigatorio = (msg: string) =>
  z.string(msg).refine((v) => ehUuid(v), msg)

/** '' ou ausente vira null; qualquer outra coisa precisa ser uuid. */
const uuidOpcional = (msg: string) =>
  z
    .string()
    .nullish()
    .refine((v) => v == null || v === '' || ehUuid(v), msg)
    .transform((v) => (v == null || v === '' ? null : v))

/**
 * Favorecido opcional: vazio/espaços (ou só tratamento, ex.: "senhor") → ausente (null/null).
 * A grafia exibida é a digitada (aparada); a chave é a normalizada.
 */
const favorecidoSchema = z
  .string()
  .nullish()
  .superRefine((v, ctx) => {
    if ((v ?? '').trim().replace(/\s+/g, ' ').length > FAVORECIDO_MAX) {
      ctx.addIssue({ code: 'custom', message: 'validacao.favorecidoLongo' })
    }
  })
  .transform((v) => {
    const l = limparFavorecido(v ?? '')
    return { favorecido: l?.favorecido ?? null, favorecidoChave: l?.chave ?? null }
  })

export const lancamentoSchema = z
  .object({
    valor: valorSchema,
    tipo: z.enum(TIPOS_LANCAMENTO, 'validacao.tipoLancamentoInvalido'),
    data: dataSchema,
    descricao: z
      .string('validacao.descricaoObrigatoria')
      .trim()
      .min(1, 'validacao.descricaoObrigatoria')
      .max(200, 'validacao.descricaoLonga'),
    contaId: uuidObrigatorio('validacao.contaObrigatoria'),
    categoriaId: uuidOpcional('validacao.categoriaInvalida'),
    status: z.enum(STATUS_LANCAMENTO, 'validacao.statusInvalido').default('efetivado'),
    favorecido: favorecidoSchema,
  })
  .transform(({ valor, tipo, favorecido, ...resto }) => {
    const abs = Math.abs(parseValorBR(valor) as number)
    return { ...resto, ...favorecido, tipo, valorCentavos: tipo === 'saida' ? -abs : abs }
  })

export type LancamentoInput = z.output<typeof lancamentoSchema>

export const POR_PAGINA = 50

const dataOpcional = z.string().refine((v) => normalizarDataBR(v) !== null)

export const filtrosSchema = z.object({
  de: dataOpcional.optional(),
  ate: dataOpcional.optional(),
  contaId: z.string().refine(ehUuid).optional(),
  categoriaId: z.string().refine(ehUuid).optional(),
  texto: z.string().max(100).optional(),
  /** Nome digitado ou chave; o serviço compara por `normalizarFavorecido`. */
  favorecidoChave: z.string().max(FAVORECIDO_MAX).optional(),
  pagina: z.number().int().min(1),
})

export type FiltrosLancamentos = z.infer<typeof filtrosSchema>

type SearchParams = Record<string, string | string[] | undefined>

const primeiro = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

/** Lê filtros dos searchParams; valores inválidos são descartados em silêncio. */
export function lerFiltros(sp: SearchParams): FiltrosLancamentos {
  const f: FiltrosLancamentos = { pagina: 1 }
  const de = normalizarDataBR(primeiro(sp.de) ?? '')
  if (de) f.de = de
  const ate = normalizarDataBR(primeiro(sp.ate) ?? '')
  if (ate) f.ate = ate
  const conta = primeiro(sp.contaId)
  if (ehUuid(conta)) f.contaId = conta
  const cat = primeiro(sp.categoriaId)
  if (ehUuid(cat)) f.categoriaId = cat
  const texto = primeiro(sp.texto)?.trim().slice(0, 100)
  if (texto) f.texto = texto
  const fav = primeiro(sp.favorecidoChave)?.trim().slice(0, FAVORECIDO_MAX)
  if (fav) f.favorecidoChave = fav
  const pag = Number(primeiro(sp.pagina))
  if (Number.isInteger(pag) && pag >= 1) f.pagina = Math.min(pag, 100000)
  return f
}
