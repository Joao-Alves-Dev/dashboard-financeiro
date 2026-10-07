import 'server-only'
import { getTranslations } from 'next-intl/server'
import type { z } from 'zod'
import type { ActionResult } from './action-result'
import { codigoPg, ErroDominio } from './erro-dominio'
import { errosPorCampo } from './erros-zod'

/**
 * Executa o corpo de uma action convertendo erros conhecidos em ActionResult
 * (ErroDominio, violação de FK, RLS). Erros inesperados viram mensagem genérica.
 * redirect()/notFound() do Next são relançados.
 */
export async function executar<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const t = await getTranslations()
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    if (e instanceof ErroDominio) return { ok: false, erro: t(e.chave, e.params) }
    const digest = (e as { digest?: unknown } | null)?.digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw e
    const c = codigoPg(e)
    if (c === '23503') return { ok: false, erro: t('comum.erroReferencia') }
    if (c === '42501') return { ok: false, erro: t('comum.semAcesso') }
    console.error('[action] falha inesperada', c ?? '', e instanceof Error ? e.message : '')
    return { ok: false, erro: t('comum.erroGenerico') }
  }
}

/** Valida a entrada com Zod; em falha devolve o ActionResult com erros por campo (mensagens traduzidas). */
export async function validarEntrada<S extends z.ZodType>(
  schema: S,
  entrada: unknown,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; resultado: ActionResult<never> }> {
  const parsed = schema.safeParse(entrada)
  if (parsed.success) return { ok: true, data: parsed.data }
  const t = await getTranslations()
  return {
    ok: false,
    resultado: {
      ok: false,
      erro: t('comum.corrijaCampos'),
      campos: errosPorCampo(parsed.error, (c) => t(c)),
    },
  }
}
