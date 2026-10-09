import 'server-only'
import { and, asc, count, desc, eq, sql, sum } from 'drizzle-orm'
import { comUsuario, type Tx } from '@/db/com-usuario'
import { aportesMeta, metas } from '@/db/schema'
import { ErroDominio } from '@/lib/erro-dominio'
import { formatarBRL } from '@/lib/money'
import { ehUuid } from '@/lib/uuid'
import { calcularMeta } from './calcular-meta'
import { ordenarPorUrgencia } from './ordenar-metas'
import type { AporteInput, MetaInput } from './schemas'
import { mediaArredondada, mesesFechados } from './sobra-media'
import type { Aporte, Meta, MetaCalculada } from './tipos'

/**
 * Camada de metas por userId (testável sem headers do Next). Tudo passa por `comUsuario`; RLS + FK composta
 * (workspace_id, meta_id) garantem o isolamento.
 *
 * Regras:
 *  - `guardado` = soma de TODOS os aportes da meta (retirada = valor negativo), independentemente da data.
 *  - Invariante: o guardado nunca fica negativo. Retirada maior que o guardado e exclusão de aporte que
 *    deixaria o guardado negativo são rejeitadas. As mutações de aporte travam a linha da meta
 *    (`for update`) para duas retiradas simultâneas não furarem a regra.
 *  - Conclusão automática: depois de toda mutação que muda o guardado ou o alvo, `concluida_em` é marcado
 *    (now()) quando guardado >= alvo e estava nulo, e limpo quando guardado < alvo. Enquanto o guardado
 *    continuar >= alvo, o instante original é preservado.
 *  - Aporte NÃO é lançamento: não altera o resultado do mês.
 */

/** Falha com 42501 (sem acesso) se o usuário não é membro do workspace. */
async function exigirMembro(tx: Tx, ws: string): Promise<void> {
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
  await tx.execute(sql`select public.exigir_membro(${ws}::uuid)`)
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
function exigirHoje(hoje: string): string {
  if (!ISO.test(hoje)) throw new Error(`data inválida: ${hoje}`)
  return hoje
}

/** Trava a linha da meta e a devolve; ErroDominio se não existe neste workspace. */
async function travarMeta(tx: Tx, ws: string, metaId: string): Promise<Meta> {
  if (!ehUuid(metaId)) throw new ErroDominio('metas.erros.naoEncontrada')
  const [m] = await tx
    .select()
    .from(metas)
    .where(and(eq(metas.id, metaId), eq(metas.workspaceId, ws)))
    .for('update')
  if (!m) throw new ErroDominio('metas.erros.naoEncontrada')
  return m
}

async function guardadoDaMeta(tx: Tx, ws: string, metaId: string): Promise<number> {
  const [r] = await tx
    .select({ total: sum(aportesMeta.valorCentavos) })
    .from(aportesMeta)
    .where(and(eq(aportesMeta.workspaceId, ws), eq(aportesMeta.metaId, metaId)))
  return Number(r?.total ?? 0)
}

/** Marca/limpa `concluida_em` conforme guardado >= alvo. Devolve o novo guardado e se está concluída. */
async function sincronizarConclusao(tx: Tx, ws: string, meta: Meta): Promise<{ guardado: number; concluida: boolean }> {
  const guardado = await guardadoDaMeta(tx, ws, meta.id)
  const concluida = guardado >= meta.valorAlvoCentavos
  if (concluida && meta.concluidaEm === null) {
    await tx.update(metas).set({ concluidaEm: sql`now()` }).where(and(eq(metas.id, meta.id), eq(metas.workspaceId, ws)))
  } else if (!concluida && meta.concluidaEm !== null) {
    await tx.update(metas).set({ concluidaEm: null }).where(and(eq(metas.id, meta.id), eq(metas.workspaceId, ws)))
  }
  return { guardado, concluida }
}

// ---------- Sobra média ----------

/**
 * Sobra média = média inteira (arredondada ao mais próximo, metades afastando de zero) do `resultado`
 * (entradas efetivadas - saídas efetivadas) dos 3 meses FECHADOS anteriores ao mês de `hoje`. Vem de
 * `resumo_mensal`, que devolve uma linha por mês mesmo sem lançamentos: mês vazio conta 0 (puxa a média
 * para baixo); workspace sem nenhum lançamento nesses meses = 0. O mês corrente nunca entra.
 */
async function sobraMediaTx(tx: Tx, ws: string, hoje: string): Promise<number> {
  const { de, ate } = mesesFechados(exigirHoje(hoje))
  const r = await tx.execute(
    sql`select resultado::text as resultado from resumo_mensal(${ws}::uuid, ${de}::date, ${ate}::date)`,
  )
  return mediaArredondada((r.rows as { resultado: string }[]).map((x) => Number(x.resultado)))
}

export async function sobraMedia3MesesDoUsuario(userId: string, ws: string, hoje: string): Promise<number> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    return sobraMediaTx(tx, ws, hoje)
  })
}

// ---------- Leitura ----------

/** Metas do workspace com guardado e cálculo, em ordem de urgência (vencidas/atrasadas, no ritmo, concluídas). */
export async function listarMetasDoUsuario(userId: string, ws: string, hoje: string): Promise<MetaCalculada[]> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const lista = await tx.select().from(metas).where(eq(metas.workspaceId, ws)).orderBy(asc(metas.criadoEm), asc(metas.id))
    if (lista.length === 0) return []
    const somas = await tx
      .select({ metaId: aportesMeta.metaId, total: sum(aportesMeta.valorCentavos) })
      .from(aportesMeta)
      .where(eq(aportesMeta.workspaceId, ws))
      .groupBy(aportesMeta.metaId)
    const guardadoPor = new Map(somas.map((s) => [s.metaId, Number(s.total ?? 0)]))
    const sobra = await sobraMediaTx(tx, ws, hoje)
    return ordenarPorUrgencia(
      lista.map((m) => {
        const guardado = guardadoPor.get(m.id) ?? 0
        return {
          ...m,
          guardado,
          calculo: calcularMeta({ alvo: m.valorAlvoCentavos, guardado, dataAlvo: m.dataAlvo, hoje, sobraMedia: sobra }),
        }
      }),
    )
  })
}

/** Todos os aportes do workspace (mais recentes primeiro); a tela agrupa por meta. */
export async function listarAportesDoUsuario(userId: string, ws: string): Promise<Aporte[]> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    return tx
      .select({
        id: aportesMeta.id,
        metaId: aportesMeta.metaId,
        data: aportesMeta.data,
        valorCentavos: aportesMeta.valorCentavos,
        observacao: aportesMeta.observacao,
      })
      .from(aportesMeta)
      .where(eq(aportesMeta.workspaceId, ws))
      .orderBy(desc(aportesMeta.data), desc(aportesMeta.criadoEm), desc(aportesMeta.id))
  })
}

// ---------- Metas ----------

export async function criarMetaDoUsuario(userId: string, ws: string, d: MetaInput): Promise<Meta> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const [m] = await tx
      .insert(metas)
      .values({ workspaceId: ws, nome: d.nome, valorAlvoCentavos: d.valorAlvoCentavos, dataAlvo: d.dataAlvo })
      .returning()
    return m
  })
}

/** Editar o alvo pode concluir (alvo reduzido) ou reabrir (alvo aumentado) a meta: `concluida_em` é sincronizado. */
export async function editarMetaDoUsuario(userId: string, ws: string, id: string, d: MetaInput): Promise<Meta> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    await travarMeta(tx, ws, id)
    const [m] = await tx
      .update(metas)
      .set({ nome: d.nome, valorAlvoCentavos: d.valorAlvoCentavos, dataAlvo: d.dataAlvo })
      .where(and(eq(metas.id, id), eq(metas.workspaceId, ws)))
      .returning()
    await sincronizarConclusao(tx, ws, m)
    const [final] = await tx.select().from(metas).where(and(eq(metas.id, id), eq(metas.workspaceId, ws)))
    return final
  })
}

/** Com aportes, exige `confirmar: true`; sem confirmação nada é apagado. Os aportes caem por cascade. */
export async function excluirMetaDoUsuario(
  userId: string,
  ws: string,
  id: string,
  confirmar: boolean,
): Promise<{ aportesApagados: number }> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    await travarMeta(tx, ws, id)
    const [{ n }] = await tx
      .select({ n: count() })
      .from(aportesMeta)
      .where(and(eq(aportesMeta.metaId, id), eq(aportesMeta.workspaceId, ws)))
    const qtd = Number(n)
    if (qtd > 0 && !confirmar) throw new ErroDominio('metas.erros.exigeConfirmacao', { qtd })
    await tx.delete(metas).where(and(eq(metas.id, id), eq(metas.workspaceId, ws)))
    return { aportesApagados: qtd }
  })
}

// ---------- Aportes ----------

/** Aporte (valor > 0) ou retirada (valor < 0). Rejeita retirada maior que o guardado. */
export async function registrarAporteDoUsuario(
  userId: string,
  ws: string,
  metaId: string,
  d: AporteInput,
): Promise<{ id: string; guardado: number; concluida: boolean }> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const meta = await travarMeta(tx, ws, metaId)
    const antes = await guardadoDaMeta(tx, ws, metaId)
    if (antes + d.valorCentavos < 0) {
      throw new ErroDominio('metas.erros.retiradaMaiorQueGuardado', { guardado: formatarBRL(antes) })
    }
    const [a] = await tx
      .insert(aportesMeta)
      .values({ workspaceId: ws, metaId, data: d.data, valorCentavos: d.valorCentavos, observacao: d.observacao })
      .returning({ id: aportesMeta.id })
    const r = await sincronizarConclusao(tx, ws, meta)
    return { id: a.id, ...r }
  })
}

/** Exclui um aporte/retirada; rejeita se o guardado resultante ficaria negativo (ex.: apagar o aporte coberto por uma retirada). */
export async function excluirAporteDoUsuario(
  userId: string,
  ws: string,
  aporteId: string,
): Promise<{ guardado: number; concluida: boolean }> {
  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    if (!ehUuid(aporteId)) throw new ErroDominio('metas.erros.aporteNaoEncontrado')
    const [ap] = await tx
      .select({ id: aportesMeta.id, metaId: aportesMeta.metaId, valor: aportesMeta.valorCentavos })
      .from(aportesMeta)
      .where(and(eq(aportesMeta.id, aporteId), eq(aportesMeta.workspaceId, ws)))
    if (!ap) throw new ErroDominio('metas.erros.aporteNaoEncontrado')
    const meta = await travarMeta(tx, ws, ap.metaId)
    const antes = await guardadoDaMeta(tx, ws, ap.metaId)
    if (antes - Number(ap.valor) < 0) throw new ErroDominio('metas.erros.excluirDeixaNegativo')
    await tx.delete(aportesMeta).where(and(eq(aportesMeta.id, aporteId), eq(aportesMeta.workspaceId, ws)))
    return sincronizarConclusao(tx, ws, meta)
  })
}
