'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { aporteSchema, metaSchema } from './schemas'
import {
  criarMetaDoUsuario,
  editarMetaDoUsuario,
  excluirAporteDoUsuario,
  excluirMetaDoUsuario,
  registrarAporteDoUsuario,
} from './servico'

/** Entrada crua (strings do formulário); validada e convertida por `metaSchema`. */
export type MetaForm = z.input<typeof metaSchema>

function revalidar(ws: string) {
  // Tela de metas e card do dashboard vivem sob o layout do workspace.
  revalidatePath(`/w/${ws}`, 'layout')
}

function exigirUuid(...ids: string[]) {
  if (!ids.every(ehUuid)) throw new ErroDominio('metas.erros.naoEncontrada')
}

export async function criarMeta(workspaceId: string, input: MetaForm): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(metaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    const m = await criarMetaDoUsuario(u.id, workspaceId, v.data)
    return { id: m.id }
  })
  if (r.ok) revalidar(workspaceId)
  return r
}

export async function editarMeta(workspaceId: string, id: string, input: MetaForm): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(metaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    const m = await editarMetaDoUsuario(u.id, workspaceId, id, v.data)
    return { id: m.id }
  })
  if (r.ok) revalidar(workspaceId)
  return r
}

/** Meta com aportes só é excluída com `confirmar: true`; os aportes são apagados junto. */
export async function excluirMeta(
  workspaceId: string,
  id: string,
  confirmar: boolean = false,
): Promise<ActionResult<{ aportesApagados: number }>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    return excluirMetaDoUsuario(u.id, workspaceId, id, confirmar === true)
  })
  if (r.ok) revalidar(workspaceId)
  return r
}

/** `valor` em texto BR; positivo = aporte, negativo = retirada. */
export async function registrarAporte(
  workspaceId: string,
  metaId: string,
  data: string,
  valor: string,
  observacao?: string,
): Promise<ActionResult<{ id: string; guardado: number; concluida: boolean }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(aporteSchema, { valor, data, observacao })
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, metaId)
    return registrarAporteDoUsuario(u.id, workspaceId, metaId, v.data)
  })
  if (r.ok) revalidar(workspaceId)
  return r
}

export async function excluirAporte(
  workspaceId: string,
  aporteId: string,
): Promise<ActionResult<{ guardado: number; concluida: boolean }>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, aporteId)
    return excluirAporteDoUsuario(u.id, workspaceId, aporteId)
  })
  if (r.ok) revalidar(workspaceId)
  return r
}
