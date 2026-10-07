'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { lancamentoSchema } from './schemas'
import {
  categorizarEmLoteDoUsuario,
  criarLancamentoDoUsuario,
  editarLancamentoDoUsuario,
  excluirLancamentoDoUsuario,
} from './servico'

/** Entrada crua (strings do formulário); validada e convertida por `lancamentoSchema`. */
export type LancamentoForm = z.input<typeof lancamentoSchema>

const UM_ANO = 60 * 60 * 24 * 365

function exigirUuid(...ids: string[]) {
  if (!ids.every(ehUuid)) throw new ErroDominio('lancamentos.naoEncontrado')
}

export async function criarLancamento(
  workspaceId: string,
  input: LancamentoForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(lancamentoSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    const l = await criarLancamentoDoUsuario(u.id, workspaceId, v.data)
    return { id: l.id }
  })
  if (r.ok) {
    // Lido pelo lançamento rápido (Task 14) para pré-selecionar a última conta usada.
    const jar = await cookies()
    jar.set(`ultima_conta_${workspaceId}`, v.data.contaId, {
      path: '/',
      maxAge: UM_ANO,
      sameSite: 'lax',
      httpOnly: true,
    })
    revalidatePath(`/w/${workspaceId}`, 'layout')
  }
  return r
}

export async function editarLancamento(
  workspaceId: string,
  id: string,
  input: LancamentoForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(lancamentoSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    const l = await editarLancamentoDoUsuario(u.id, workspaceId, id, v.data)
    return { id: l.id }
  })
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}

export async function excluirLancamento(workspaceId: string, id: string): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    await excluirLancamentoDoUsuario(u.id, workspaceId, id)
    return null
  })
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}

export async function categorizarEmLote(
  workspaceId: string,
  ids: string[],
  categoriaId: string | null,
): Promise<ActionResult<{ atualizados: number }>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    if (!Array.isArray(ids)) throw new ErroDominio('lancamentos.loteVazio')
    return categorizarEmLoteDoUsuario(u.id, workspaceId, ids, categoriaId)
  })
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}
