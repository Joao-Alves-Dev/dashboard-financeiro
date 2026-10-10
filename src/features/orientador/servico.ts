import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { comUsuario, type Tx } from '@/db/com-usuario'
import { alertasDispensados, configOrientador } from '@/db/schema'
import { inicioDoMes } from '@/features/dashboard/periodo'
import { ErroDominio } from '@/lib/erro-dominio'
import { ehUuid } from '@/lib/uuid'
import { montarContextoDoUsuario } from './contexto'
import { avaliar } from './motor'
import type { ConfigInput, DispensarInput } from './schemas'
import { CONFIG_PADRAO, type Alerta, type ConfigOrientador, type ContextoFinanceiro, type Severidade } from './tipos'

/**
 * Camada do orientador por userId (testável sem headers do Next). Tudo passa por `comUsuario`; RLS isola os
 * workspaces. Sem linha em `config_orientador` valem os padrões (15, 30, 30).
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/
function exigirHoje(hoje: string): string {
  if (!ISO.test(hoje)) throw new Error(`data inválida: ${hoje}`)
  return hoje
}

/** Falha com 42501 (sem acesso) se o usuário não é membro do workspace. */
async function exigirMembro(tx: Tx, ws: string): Promise<void> {
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
  await tx.execute(sql`select public.exigir_membro(${ws}::uuid)`)
}

// ---------- Configuração ----------

export async function carregarConfigDoUsuario(userId: string, ws: string): Promise<ConfigOrientador> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const [c] = await tx.select().from(configOrientador).where(eq(configOrientador.workspaceId, ws))
    return c
      ? { limiteCategoriaPct: c.limiteCategoriaPct, altaPct: c.altaPct, cartaoPct: c.cartaoPct }
      : { ...CONFIG_PADRAO }
  })
}

export async function salvarConfigDoUsuario(userId: string, ws: string, d: ConfigInput): Promise<ConfigOrientador> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    await tx
      .insert(configOrientador)
      .values({ workspaceId: ws, ...d })
      .onConflictDoUpdate({ target: configOrientador.workspaceId, set: d })
    return { ...d }
  })
}

/** Volta aos padrões apagando a linha. */
export async function restaurarConfigDoUsuario(userId: string, ws: string): Promise<ConfigOrientador> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    await tx.delete(configOrientador).where(eq(configOrientador.workspaceId, ws))
    return { ...CONFIG_PADRAO }
  })
}

// ---------- Alertas ----------

export type AlertaDispensado = { regraId: string; chave: string; severidade: Severidade; mes: string }

async function dispensadosDoMes(tx: Tx, ws: string, mes: string): Promise<AlertaDispensado[]> {
  const linhas = await tx
    .select()
    .from(alertasDispensados)
    .where(and(eq(alertasDispensados.workspaceId, ws), eq(alertasDispensados.mes, mes)))
  return linhas.map((l) => ({ regraId: l.regraId, chave: l.chave, severidade: l.severidade as Severidade, mes: l.mes }))
}

export async function montarContexto(userId: string, ws: string, hoje: string): Promise<ContextoFinanceiro> {
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
  return montarContextoDoUsuario(userId, ws, exigirHoje(hoje))
}

/** Alertas ativos do mês de `hoje`: config (ou padrões), dispensas do mês corrente e `avaliar`. */
export async function listarAlertasDoUsuario(userId: string, ws: string, hoje: string): Promise<Alerta[]> {
  exigirHoje(hoje)
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
  const mes = inicioDoMes(hoje)
  const [cfg, dispensados, ctx] = await Promise.all([
    carregarConfigDoUsuario(userId, ws),
    comUsuario(userId, async (tx) => {
      await exigirMembro(tx, ws)
      return dispensadosDoMes(tx, ws, mes)
    }),
    montarContextoDoUsuario(userId, ws, hoje),
  ])
  return avaliar(ctx, cfg, dispensados)
}

/**
 * Dispensa a instância (regra, chave) até o fim do mês de `hoje`. Dispensar de novo atualiza a severidade
 * gravada (sobe ou desce); o alerta só reaparece se a severidade atual passar da gravada ou no mês seguinte.
 */
export async function dispensarAlertaDoUsuario(userId: string, ws: string, d: DispensarInput, hoje: string): Promise<void> {
  const mes = inicioDoMes(exigirHoje(hoje))
  await comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    await tx
      .insert(alertasDispensados)
      .values({ workspaceId: ws, regraId: d.regraId, chave: d.chave, mes, severidade: d.severidade })
      .onConflictDoUpdate({
        target: [alertasDispensados.workspaceId, alertasDispensados.regraId, alertasDispensados.chave, alertasDispensados.mes],
        set: { severidade: d.severidade, criadoEm: sql`now()` },
      })
  })
}
