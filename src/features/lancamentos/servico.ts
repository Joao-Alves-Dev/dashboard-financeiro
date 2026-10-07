import 'server-only'
import { and, count, desc, eq, gte, ilike, inArray, lte, type SQL } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { lancamentos } from '@/db/schema'
import { ErroDominio } from '@/lib/erro-dominio'
import { ehUuid } from '@/lib/uuid'
import { POR_PAGINA, type FiltrosLancamentos, type LancamentoInput } from './schemas'

export type Lancamento = typeof lancamentos.$inferSelect

/** Escapa `\`, `%` e `_` para o texto do usuário valer literalmente num LIKE. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => '\\' + c)
}

export async function listarLancamentosDoUsuario(
  userId: string,
  ws: string,
  f: FiltrosLancamentos,
): Promise<{ itens: Lancamento[]; total: number }> {
  const condicoes: (SQL | undefined)[] = [eq(lancamentos.workspaceId, ws)]
  if (f.de) condicoes.push(gte(lancamentos.data, f.de))
  if (f.ate) condicoes.push(lte(lancamentos.data, f.ate))
  if (f.contaId) condicoes.push(eq(lancamentos.contaId, f.contaId))
  if (f.categoriaId) condicoes.push(eq(lancamentos.categoriaId, f.categoriaId))
  if (f.texto) condicoes.push(ilike(lancamentos.descricao, `%${escaparLike(f.texto)}%`))
  const where = and(...condicoes)

  return comUsuario(userId, async (tx) => {
    const [{ total }] = await tx.select({ total: count() }).from(lancamentos).where(where)
    const itens = await tx
      .select()
      .from(lancamentos)
      .where(where)
      .orderBy(desc(lancamentos.data), desc(lancamentos.criadoEm), desc(lancamentos.id))
      .limit(POR_PAGINA)
      .offset((Math.max(1, f.pagina) - 1) * POR_PAGINA)
    return { itens, total: Number(total) }
  })
}

export async function criarLancamentoDoUsuario(
  userId: string,
  ws: string,
  d: LancamentoInput,
): Promise<Lancamento> {
  return comUsuario(userId, async (tx) => {
    const [l] = await tx
      .insert(lancamentos)
      .values({
        workspaceId: ws,
        contaId: d.contaId,
        categoriaId: d.categoriaId,
        data: d.data,
        descricao: d.descricao,
        valorCentavos: d.valorCentavos,
        status: d.status,
      })
      .returning()
    return l
  })
}

export async function editarLancamentoDoUsuario(
  userId: string,
  ws: string,
  id: string,
  d: LancamentoInput,
): Promise<Lancamento> {
  return comUsuario(userId, async (tx) => {
    const linhas = await tx
      .update(lancamentos)
      .set({
        contaId: d.contaId,
        categoriaId: d.categoriaId,
        data: d.data,
        descricao: d.descricao,
        valorCentavos: d.valorCentavos,
        status: d.status,
      })
      .where(and(eq(lancamentos.id, id), eq(lancamentos.workspaceId, ws)))
      .returning()
    if (linhas.length === 0) throw new ErroDominio('lancamentos.naoEncontrado')
    return linhas[0]
  })
}

export async function excluirLancamentoDoUsuario(userId: string, ws: string, id: string): Promise<void> {
  await comUsuario(userId, async (tx) => {
    const linhas = await tx
      .delete(lancamentos)
      .where(and(eq(lancamentos.id, id), eq(lancamentos.workspaceId, ws)))
      .returning({ id: lancamentos.id })
    if (linhas.length === 0) throw new ErroDominio('lancamentos.naoEncontrado')
  })
}

export const MAX_LOTE = 500

/**
 * Atribui a categoria a todos os ids numa única transação. Se algum id não pertencer
 * ao workspace (ou não existir), lança e nada é alterado.
 */
export async function categorizarEmLoteDoUsuario(
  userId: string,
  ws: string,
  ids: string[],
  categoriaId: string | null,
): Promise<{ atualizados: number }> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) throw new ErroDominio('lancamentos.loteVazio')
  if (unicos.length > MAX_LOTE) throw new ErroDominio('lancamentos.loteGrande', { max: MAX_LOTE })
  if (!unicos.every(ehUuid) || (categoriaId !== null && !ehUuid(categoriaId))) {
    throw new ErroDominio('lancamentos.naoEncontrado')
  }
  return comUsuario(userId, async (tx) => {
    const existentes = await tx
      .select({ id: lancamentos.id })
      .from(lancamentos)
      .where(and(eq(lancamentos.workspaceId, ws), inArray(lancamentos.id, unicos)))
    if (existentes.length !== unicos.length) throw new ErroDominio('lancamentos.loteInvalido')
    const atualizados = await tx
      .update(lancamentos)
      .set({ categoriaId })
      .where(and(eq(lancamentos.workspaceId, ws), inArray(lancamentos.id, unicos)))
      .returning({ id: lancamentos.id })
    return { atualizados: atualizados.length }
  })
}
