import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import { listarLancamentosParaExportarDoUsuario, type ParamsExportacao, type ResultadoExportacao } from './servico'

export type { ParamsExportacao, ResultadoExportacao }

/** Lançamentos efetivados para a lista exportada (sem paginação; teto de 2000 linhas). */
export async function listarLancamentosParaExportar(ws: string, p: ParamsExportacao): Promise<ResultadoExportacao> {
  const u = await exigirUsuario()
  return listarLancamentosParaExportarDoUsuario(u.id, ws, p)
}
