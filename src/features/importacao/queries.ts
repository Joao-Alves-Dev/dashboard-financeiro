import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import { listarImportacoesDoUsuario, type ItemHistorico } from './servico'

export type { ItemHistorico }

export async function listarImportacoes(ws: string): Promise<ItemHistorico[]> {
  const u = await exigirUsuario()
  return listarImportacoesDoUsuario(u.id, ws)
}
