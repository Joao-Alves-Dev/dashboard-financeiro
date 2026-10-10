import 'server-only'
import { sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'

export type FavorecidoSugestao = { chave: string; nome: string; total: number }

/**
 * Favorecidos do workspace agrupados por chave normalizada. `nome` é a grafia do lançamento mais
 * recente (data desc, depois criado_em desc); `total` é a quantidade de lançamentos. Ordem: total
 * desc, depois nome. Lançamentos sem favorecido são ignorados.
 */
export async function listarFavorecidosDoUsuario(userId: string, ws: string): Promise<FavorecidoSugestao[]> {
  return comUsuario(userId, async (tx) => {
    const r = await tx.execute(sql`
      select favorecido_chave as chave,
             (array_agg(favorecido order by data desc, criado_em desc, id desc))[1] as nome,
             count(*)::int as total
        from lancamentos
       where workspace_id = ${ws} and favorecido_chave is not null
       group by favorecido_chave
       order by total desc, 2 asc, favorecido_chave asc`)
    return (r.rows as { chave: string; nome: string; total: number }[]).map((l) => ({
      chave: l.chave,
      nome: l.nome,
      total: Number(l.total),
    }))
  })
}
