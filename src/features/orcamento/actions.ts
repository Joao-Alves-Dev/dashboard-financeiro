'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-result'
import { executar } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { copiarMesAnteriorDoUsuario, salvarOrcamentoDoUsuario } from './servico'

/** Upsert do orçamento; `valor` vazio apaga, "0" grava zero. Revalida o workspace (grade e card do dashboard). */
export async function salvarOrcamento(
  workspaceId: string,
  categoriaId: string,
  mes: string,
  valor: string,
): Promise<ActionResult<void>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    await salvarOrcamentoDoUsuario(u.id, workspaceId, categoriaId, mes, String(valor ?? ''))
  })
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}

/** Copia o orçamento do mês anterior para `mes` sem sobrescrever o que já existe. */
export async function copiarMesAnterior(workspaceId: string, mes: string): Promise<ActionResult<{ copiados: number }>> {
  const u = await exigirUsuario()
  const r = await executar(() => copiarMesAnteriorDoUsuario(u.id, workspaceId, mes))
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}
