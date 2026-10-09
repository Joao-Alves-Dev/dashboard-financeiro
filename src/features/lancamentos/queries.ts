import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import type { FiltrosLancamentos } from './schemas'
import { categoriasFrequentesDoUsuario, listarLancamentosDoUsuario, type CategoriaFrequente, type Lancamento } from './servico'

export type { Lancamento }

export async function listarLancamentos(
  ws: string,
  f: FiltrosLancamentos,
): Promise<{ itens: Lancamento[]; total: number }> {
  const u = await exigirUsuario()
  return listarLancamentosDoUsuario(u.id, ws, f)
}

/** Categorias de despesa mais usadas (saídas) nos últimos 60 dias até `hoje`. */
export async function categoriasFrequentes(ws: string, hoje: string, limite = 6): Promise<CategoriaFrequente[]> {
  const u = await exigirUsuario()
  return categoriasFrequentesDoUsuario(u.id, ws, hoje, limite)
}
