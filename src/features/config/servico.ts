import 'server-only'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categorias, contas, lancamentos, regrasCategoria } from '@/db/schema'
import { ErroDominio } from '@/lib/erro-dominio'
import type { CategoriaInput, ContaInput, RegraInput } from './schemas'

export type Conta = typeof contas.$inferSelect
export type Categoria = typeof categorias.$inferSelect
export type RegraDb = typeof regrasCategoria.$inferSelect
export type ContaComContagem = Conta & { qtdLancamentos: number }

// ---------- Contas ----------

export async function listarContasDoUsuario(userId: string, ws: string): Promise<ContaComContagem[]> {
  return comUsuario(userId, async (tx) => {
    const lista = await tx.select().from(contas).where(eq(contas.workspaceId, ws)).orderBy(asc(contas.nome), asc(contas.id))
    const contagens = await tx
      .select({ contaId: lancamentos.contaId, n: count() })
      .from(lancamentos)
      .where(eq(lancamentos.workspaceId, ws))
      .groupBy(lancamentos.contaId)
    const porConta = new Map(contagens.map((c) => [c.contaId, Number(c.n)]))
    return lista.map((c) => ({ ...c, qtdLancamentos: porConta.get(c.id) ?? 0 }))
  })
}

export async function criarContaDoUsuario(userId: string, ws: string, d: ContaInput): Promise<Conta> {
  return comUsuario(userId, async (tx) => {
    const [c] = await tx
      .insert(contas)
      .values({ workspaceId: ws, nome: d.nome, tipo: d.tipo, saldoInicialCentavos: d.saldoInicialCentavos })
      .returning()
    return c
  })
}

export async function editarContaDoUsuario(userId: string, ws: string, id: string, d: ContaInput): Promise<Conta> {
  return comUsuario(userId, async (tx) => {
    const linhas = await tx
      .update(contas)
      .set({ nome: d.nome, tipo: d.tipo, saldoInicialCentavos: d.saldoInicialCentavos })
      .where(and(eq(contas.id, id), eq(contas.workspaceId, ws)))
      .returning()
    if (linhas.length === 0) throw new ErroDominio('config.contaNaoEncontrada')
    return linhas[0]
  })
}

/**
 * Excluir conta apaga também seus lançamentos (cascade). Com lançamentos, exige `confirmar: true`;
 * sem confirmação nada é apagado e o erro informa a contagem.
 */
export async function excluirContaDoUsuario(
  userId: string,
  ws: string,
  id: string,
  confirmar: boolean,
): Promise<{ lancamentosApagados: number }> {
  return comUsuario(userId, async (tx) => {
    const [conta] = await tx
      .select({ id: contas.id })
      .from(contas)
      .where(and(eq(contas.id, id), eq(contas.workspaceId, ws)))
    if (!conta) throw new ErroDominio('config.contaNaoEncontrada')
    const [{ n }] = await tx
      .select({ n: count() })
      .from(lancamentos)
      .where(and(eq(lancamentos.contaId, id), eq(lancamentos.workspaceId, ws)))
    const qtd = Number(n)
    if (qtd > 0 && !confirmar) throw new ErroDominio('config.contaExigeConfirmacao', { qtd })
    await tx.delete(contas).where(and(eq(contas.id, id), eq(contas.workspaceId, ws)))
    return { lancamentosApagados: qtd }
  })
}

// ---------- Categorias ----------

export async function listarCategoriasDoUsuario(userId: string, ws: string): Promise<Categoria[]> {
  return comUsuario(userId, (tx) =>
    tx
      .select()
      .from(categorias)
      .where(eq(categorias.workspaceId, ws))
      .orderBy(asc(categorias.natureza), asc(categorias.nome), asc(categorias.id)),
  )
}

export async function criarCategoriaDoUsuario(userId: string, ws: string, d: CategoriaInput): Promise<Categoria> {
  return comUsuario(userId, async (tx) => {
    const [c] = await tx
      .insert(categorias)
      .values({ workspaceId: ws, nome: d.nome, natureza: d.natureza, cor: d.cor })
      .returning()
    return c
  })
}

export async function editarCategoriaDoUsuario(
  userId: string,
  ws: string,
  id: string,
  d: CategoriaInput,
): Promise<Categoria> {
  return comUsuario(userId, async (tx) => {
    const linhas = await tx
      .update(categorias)
      .set({ nome: d.nome, natureza: d.natureza, cor: d.cor })
      .where(and(eq(categorias.id, id), eq(categorias.workspaceId, ws)))
      .returning()
    if (linhas.length === 0) throw new ErroDominio('config.categoriaNaoEncontrada')
    return linhas[0]
  })
}

/** Lançamentos da categoria ficam sem categoria; regras e orçamentos dela são apagados. */
export async function excluirCategoriaDoUsuario(userId: string, ws: string, id: string): Promise<void> {
  await comUsuario(userId, async (tx) => {
    const linhas = await tx
      .delete(categorias)
      .where(and(eq(categorias.id, id), eq(categorias.workspaceId, ws)))
      .returning({ id: categorias.id })
    if (linhas.length === 0) throw new ErroDominio('config.categoriaNaoEncontrada')
  })
}

// ---------- Regras ----------

export async function listarRegrasDoUsuario(userId: string, ws: string): Promise<RegraDb[]> {
  return comUsuario(userId, (tx) =>
    tx
      .select()
      .from(regrasCategoria)
      .where(eq(regrasCategoria.workspaceId, ws))
      .orderBy(desc(regrasCategoria.prioridade), asc(regrasCategoria.padrao), asc(regrasCategoria.id)),
  )
}

export async function criarRegraDoUsuario(userId: string, ws: string, d: RegraInput): Promise<RegraDb> {
  return comUsuario(userId, async (tx) => {
    const [r] = await tx
      .insert(regrasCategoria)
      .values({ workspaceId: ws, padrao: d.padrao, categoriaId: d.categoriaId, prioridade: d.prioridade })
      .returning()
    return r
  })
}

export async function editarRegraDoUsuario(userId: string, ws: string, id: string, d: RegraInput): Promise<RegraDb> {
  return comUsuario(userId, async (tx) => {
    const linhas = await tx
      .update(regrasCategoria)
      .set({ padrao: d.padrao, categoriaId: d.categoriaId, prioridade: d.prioridade })
      .where(and(eq(regrasCategoria.id, id), eq(regrasCategoria.workspaceId, ws)))
      .returning()
    if (linhas.length === 0) throw new ErroDominio('config.regraNaoEncontrada')
    return linhas[0]
  })
}

export async function excluirRegraDoUsuario(userId: string, ws: string, id: string): Promise<void> {
  await comUsuario(userId, async (tx) => {
    const linhas = await tx
      .delete(regrasCategoria)
      .where(and(eq(regrasCategoria.id, id), eq(regrasCategoria.workspaceId, ws)))
      .returning({ id: regrasCategoria.id })
    if (linhas.length === 0) throw new ErroDominio('config.regraNaoEncontrada')
  })
}
