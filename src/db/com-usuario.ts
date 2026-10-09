import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from './cliente'
import { comRetryAntesDeIniciar } from './retry-conexao'

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Executa fn dentro de uma transação com o usuário informado ao Postgres via
 * set_config (escopo local à transação). É o que faz o RLS enxergar usuario_atual().
 *
 * Se a conexão entregue pelo pool já tiver sido derrubada pelo servidor, a falha acontece no
 * set_config, antes de fn rodar: nesse caso (e só nele) a transação é repetida uma vez.
 */
export async function comUsuario<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return comRetryAntesDeIniciar((sinalizarInicio) =>
    db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.usuario_id', ${userId}, true)`)
      sinalizarInicio()
      return fn(tx)
    }),
  )
}
