import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { comUsuario } from '@/db/com-usuario'
import { workspaces } from '@/db/schema'
import { exigirUsuario } from '@/lib/sessao'
import type { TIPOS_WORKSPACE } from './schemas'

export type Workspace = typeof workspaces.$inferSelect

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lógica por userId (testável sem headers do Next). RLS limita aos workspaces do usuário. */
export async function listarWorkspacesDoUsuario(userId: string): Promise<Workspace[]> {
  return comUsuario(userId, (tx) =>
    tx.select().from(workspaces).orderBy(asc(workspaces.criadoEm), asc(workspaces.id)),
  )
}

/** notFound() se o id não for uuid ou se o RLS não retornar a linha. */
export async function obterWorkspaceDoUsuario(userId: string, id: string): Promise<Workspace> {
  if (!UUID.test(id)) notFound()
  const linhas = await comUsuario(userId, (tx) =>
    tx.select().from(workspaces).where(eq(workspaces.id, id)).limit(1),
  )
  if (linhas.length === 0) notFound()
  return linhas[0]
}

/** Caminho usado por /novo: cria workspace + membro dono + categorias padrão via SQL. */
export async function criarWorkspaceParaUsuario(
  userId: string,
  nome: string,
  tipo: (typeof TIPOS_WORKSPACE)[number],
): Promise<string> {
  const res = await comUsuario(userId, (tx) =>
    tx.execute(sql`select criar_workspace(${nome}, ${tipo}) as id`),
  )
  return String((res.rows[0] as { id: string }).id)
}

export async function listarWorkspaces(): Promise<Workspace[]> {
  const u = await exigirUsuario()
  return listarWorkspacesDoUsuario(u.id)
}

export async function obterWorkspace(id: string): Promise<Workspace> {
  const u = await exigirUsuario()
  return obterWorkspaceDoUsuario(u.id, id)
}
