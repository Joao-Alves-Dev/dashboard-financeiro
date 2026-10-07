'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { categoriaSchema, contaSchema, regraSchema } from './schemas'
import {
  criarCategoriaDoUsuario,
  criarContaDoUsuario,
  criarRegraDoUsuario,
  editarCategoriaDoUsuario,
  editarContaDoUsuario,
  editarRegraDoUsuario,
  excluirCategoriaDoUsuario,
  excluirContaDoUsuario,
  excluirRegraDoUsuario,
} from './servico'

export type ContaForm = z.input<typeof contaSchema>
export type CategoriaForm = z.input<typeof categoriaSchema>
export type RegraForm = z.input<typeof regraSchema>

function exigirUuid(...ids: string[]) {
  if (!ids.every(ehUuid)) throw new ErroDominio('comum.semAcesso')
}

function atualizar(ws: string) {
  revalidatePath(`/w/${ws}`, 'layout')
}

export async function criarConta(workspaceId: string, input: ContaForm): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(contaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    return { id: (await criarContaDoUsuario(u.id, workspaceId, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function editarConta(
  workspaceId: string,
  id: string,
  input: ContaForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(contaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    return { id: (await editarContaDoUsuario(u.id, workspaceId, id, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

/** Conta com lançamentos só é excluída com `confirmar: true` (apaga os lançamentos junto). */
export async function excluirConta(
  workspaceId: string,
  id: string,
  confirmar = false,
): Promise<ActionResult<{ lancamentosApagados: number }>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    return excluirContaDoUsuario(u.id, workspaceId, id, confirmar === true)
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function criarCategoria(
  workspaceId: string,
  input: CategoriaForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(categoriaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    return { id: (await criarCategoriaDoUsuario(u.id, workspaceId, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function editarCategoria(
  workspaceId: string,
  id: string,
  input: CategoriaForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(categoriaSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    return { id: (await editarCategoriaDoUsuario(u.id, workspaceId, id, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function excluirCategoria(workspaceId: string, id: string): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    await excluirCategoriaDoUsuario(u.id, workspaceId, id)
    return null
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function criarRegra(workspaceId: string, input: RegraForm): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(regraSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    return { id: (await criarRegraDoUsuario(u.id, workspaceId, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function editarRegra(
  workspaceId: string,
  id: string,
  input: RegraForm,
): Promise<ActionResult<{ id: string }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(regraSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    return { id: (await editarRegraDoUsuario(u.id, workspaceId, id, v.data)).id }
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function excluirRegra(workspaceId: string, id: string): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId, id)
    await excluirRegraDoUsuario(u.id, workspaceId, id)
    return null
  })
  if (r.ok) atualizar(workspaceId)
  return r
}
