import 'server-only'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { listarAportesDoUsuario, listarMetasDoUsuario, sobraMedia3MesesDoUsuario } from './servico'
import type { Aporte, MetaCalculada } from './tipos'

export type { Aporte, MetaCalculada }
export type { CalculoMeta, SituacaoMeta } from './calcular-meta'

/**
 * Metas com `guardado` (soma dos aportes) e `calculo` (`calcularMeta`), em ordem de urgência
 * (vencidas/atrasadas, no ritmo, concluídas). `hoje` = America/Sao_Paulo por padrão.
 */
export async function listarMetas(ws: string, hoje: string = hojeISO()): Promise<MetaCalculada[]> {
  const u = await exigirUsuario()
  return listarMetasDoUsuario(u.id, ws, hoje)
}

/** Média do resultado dos 3 meses fechados anteriores ao mês de `hoje` (definição em `servico.ts`). */
export async function sobraMedia3Meses(ws: string, hoje: string = hojeISO()): Promise<number> {
  const u = await exigirUsuario()
  return sobraMedia3MesesDoUsuario(u.id, ws, hoje)
}

export async function listarAportes(ws: string): Promise<Aporte[]> {
  const u = await exigirUsuario()
  return listarAportesDoUsuario(u.id, ws)
}
