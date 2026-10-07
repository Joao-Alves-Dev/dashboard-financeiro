import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { user } from '@/db/auth-schema'

/** Cria usuários de teste direto na tabela `user` (ids únicos por execução). */
export async function criarUsuariosTeste(qtd: number): Promise<string[]> {
  const exec = randomUUID().slice(0, 8)
  const ids = Array.from({ length: qtd }, (_, i) => `teste-${exec}-${i}`)
  await db.insert(user).values(
    ids.map((id) => ({ id, name: `Teste ${id}`, email: `${id}@teste.invalid` })),
  )
  return ids
}

/** Apaga os usuários; cascade remove workspaces, membros e dados de domínio. */
export async function apagarUsuariosTeste(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db.delete(user).where(inArray(user.id, ids))
}
