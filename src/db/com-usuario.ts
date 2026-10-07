import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from './cliente'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Executa fn dentro de uma transação com o usuário informado ao Postgres via
 * set_config (escopo local à transação). É o que faz o RLS enxergar usuario_atual().
 */
export async function comUsuario<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.usuario_id', ${userId}, true)`)
    return fn(tx)
  })
}
