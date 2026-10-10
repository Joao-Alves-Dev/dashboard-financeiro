import 'server-only'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { carregarConfigDoUsuario, listarAlertasDoUsuario, montarContexto as montarContextoDoUsuario } from './servico'
import type { Alerta, ConfigOrientador, ContextoFinanceiro } from './tipos'

export type { Alerta, ConfigOrientador, ContextoFinanceiro }

/** Foto financeira do mês de `hoje` (America/Sao_Paulo por padrão). */
export async function montarContexto(ws: string, hoje: string = hojeISO()): Promise<ContextoFinanceiro> {
  const u = await exigirUsuario()
  return montarContextoDoUsuario(u.id, ws, hoje)
}

/** Alertas ativos (já sem os dispensados no mês), do mais grave ao menos grave. */
export async function listarAlertas(ws: string, hoje: string = hojeISO()): Promise<Alerta[]> {
  const u = await exigirUsuario()
  return listarAlertasDoUsuario(u.id, ws, hoje)
}

export async function obterConfigOrientador(ws: string): Promise<ConfigOrientador> {
  const u = await exigirUsuario()
  return carregarConfigDoUsuario(u.id, ws)
}
