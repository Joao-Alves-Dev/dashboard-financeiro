import { z } from 'zod'
import { ehUuid } from '@/lib/uuid'
import { normalizarDataBR } from './datas'

export const TAMANHO_MAX_BYTES = 2 * 1024 * 1024
export const MAX_LINHAS = 5000
export const FORMATOS = ['ofx', 'csv'] as const
export type Formato = (typeof FORMATOS)[number]

// Mensagens/chaves abaixo são chaves de `messages/pt-BR.json`, traduzidas na action.

export type ValidacaoArquivo = { ok: true; extensao: Formato } | { ok: false; chave: string }

/** Extensão e tamanho do upload (o servidor não confia no navegador). */
export function validarArquivoUpload(nome: string, tamanho: number): ValidacaoArquivo {
  const m = /\.([^.\\/]+)$/.exec(nome.trim())
  const ext = m ? m[1].toLowerCase() : ''
  if (ext !== 'ofx' && ext !== 'csv') return { ok: false, chave: 'importacao.erros.extensao' }
  if (tamanho <= 0) return { ok: false, chave: 'importacao.erros.arquivoVazio' }
  if (tamanho > TAMANHO_MAX_BYTES) return { ok: false, chave: 'importacao.erros.tamanho' }
  return { ok: true, extensao: ext }
}

/** Conteúdo parece OFX (cabeçalho SGML 1.x ou raiz XML 2.x). */
export function pareceOfx(texto: string): boolean {
  return /OFXHEADER|<OFX[\s>]/i.test(texto.slice(0, 20000))
}

/**
 * Formato final: o conteúdo manda. `.ofx` cujo conteúdo não é OFX é recusado;
 * `.csv` com conteúdo OFX é tratado como OFX.
 */
export function detectarFormato(extensao: Formato, texto: string): Formato | null {
  const ofx = pareceOfx(texto)
  if (extensao === 'ofx') return ofx ? 'ofx' : null
  return ofx ? 'ofx' : 'csv'
}

export const mapeamentoSchema = z.object({
  colData: z.string().trim().min(1).max(200),
  colDescricao: z.string().trim().min(1).max(200),
  colValor: z.string().trim().min(1).max(200),
  inverterSinal: z.boolean(),
})

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => normalizarDataBR(v) === v)

/** Linha como volta do navegador para a confirmação: nada aqui é confiável. */
export const linhaConfirmacaoSchema = z.object({
  data: dataIso,
  descricao: z.string().trim().min(1).max(200),
  valorCentavos: z
    .number()
    .int()
    .refine((v) => v !== 0 && Math.abs(v) <= Number.MAX_SAFE_INTEGER),
  idExterno: z.string().min(1).max(200),
  categoriaId: z
    .string()
    .nullish()
    .refine((v) => v == null || ehUuid(v))
    .transform((v) => v ?? null),
})

export type LinhaConfirmacao = z.output<typeof linhaConfirmacaoSchema>

export const confirmarSchema = z.object({
  workspaceId: z.string().refine(ehUuid),
  contaId: z.string().refine(ehUuid),
  arquivo: z.string().trim().min(1).max(255),
  formato: z.enum(FORMATOS),
  linhas: z.array(linhaConfirmacaoSchema).min(1).max(MAX_LINHAS),
  mapeamento: mapeamentoSchema.nullish().transform((v) => v ?? null),
})

export type ConfirmarInput = z.output<typeof confirmarSchema>
