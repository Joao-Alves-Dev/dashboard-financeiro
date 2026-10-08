import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import { inicioDoMes, intervaloUltimosMeses, ultimoDiaDoMes } from './periodo'
import type { GastoCategoria } from './agrupar'
import {
  contasAPagarReceberDoUsuario,
  existeLancamentoDoUsuario,
  gastosPorCategoriaDoUsuario,
  kpisDoUsuario,
  orcamentoVsRealizadoDoUsuario,
  resumoMensalDoUsuario,
  ultimosLancamentosDoUsuario,
  type ContasAPagarReceber,
  type Kpis,
  type LancamentoRecente,
  type LinhaOrcamento,
} from './servico'
import { paraSerieGrafico, type PontoSerie } from './serie'

export type { ContasAPagarReceber, Kpis, LancamentoRecente, LinhaOrcamento }

/** Quantos meses o gráfico de entradas × saídas mostra. */
export const MESES_GRAFICO = 12
export const QTD_ULTIMOS_LANCAMENTOS = 10

/** `hoje` é 'YYYY-MM-DD' em America/Sao_Paulo (ver `hojeISO`). Cada função faz a checagem real de sessão. */
export async function obterExisteLancamento(ws: string): Promise<boolean> {
  const u = await exigirUsuario()
  return existeLancamentoDoUsuario(u.id, ws)
}

export async function obterKpis(ws: string, hoje: string): Promise<Kpis> {
  const u = await exigirUsuario()
  return kpisDoUsuario(u.id, ws, hoje)
}

export async function obterSerieMensal(ws: string, hoje: string): Promise<PontoSerie[]> {
  const u = await exigirUsuario()
  const { de, ate } = intervaloUltimosMeses(hoje, MESES_GRAFICO)
  return paraSerieGrafico(await resumoMensalDoUsuario(u.id, ws, de, ate))
}

export async function obterGastosDoMes(ws: string, hoje: string): Promise<GastoCategoria[]> {
  const u = await exigirUsuario()
  return gastosPorCategoriaDoUsuario(u.id, ws, inicioDoMes(hoje), ultimoDiaDoMes(hoje))
}

export async function obterOrcamentoDoMes(ws: string, hoje: string): Promise<LinhaOrcamento[]> {
  const u = await exigirUsuario()
  return orcamentoVsRealizadoDoUsuario(u.id, ws, inicioDoMes(hoje))
}

export async function obterUltimosLancamentos(ws: string): Promise<LancamentoRecente[]> {
  const u = await exigirUsuario()
  return ultimosLancamentosDoUsuario(u.id, ws, QTD_ULTIMOS_LANCAMENTOS)
}

export async function obterContasAPagarReceber(ws: string, hoje: string): Promise<ContasAPagarReceber> {
  const u = await exigirUsuario()
  return contasAPagarReceberDoUsuario(u.id, ws, hoje)
}
