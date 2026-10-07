import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import type { FiltrosLancamentos } from './schemas'
import { listarLancamentosDoUsuario, type Lancamento } from './servico'

export type { Lancamento }

export async function listarLancamentos(
  ws: string,
  f: FiltrosLancamentos,
): Promise<{ itens: Lancamento[]; total: number }> {
  const u = await exigirUsuario()
  return listarLancamentosDoUsuario(u.id, ws, f)
}
