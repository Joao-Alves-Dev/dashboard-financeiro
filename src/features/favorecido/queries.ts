import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import { listarFavorecidosDoUsuario, type FavorecidoSugestao } from './servico'

export type { FavorecidoSugestao }

/** Favorecidos já usados no workspace (para autocomplete e filtro). */
export async function listarFavorecidos(ws: string): Promise<FavorecidoSugestao[]> {
  const u = await exigirUsuario()
  return listarFavorecidosDoUsuario(u.id, ws)
}
