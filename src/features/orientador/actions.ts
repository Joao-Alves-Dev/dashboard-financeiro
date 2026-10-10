'use server'

import { revalidatePath } from 'next/cache'
import type { z } from 'zod'
import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { configSchema, dispensarSchema } from './schemas'
import { dispensarAlertaDoUsuario, restaurarConfigDoUsuario, salvarConfigDoUsuario } from './servico'
import type { ConfigOrientador } from './tipos'

/** Entrada crua (strings do formulário); validada e convertida por `configSchema`. */
export type ConfigOrientadorForm = z.input<typeof configSchema>

function exigirUuid(ws: string) {
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
}

function atualizar(ws: string) {
  // Dashboard (card), orientações e config vivem sob o layout do workspace.
  revalidatePath(`/w/${ws}`, 'layout')
}

export async function dispensarAlerta(
  workspaceId: string,
  regraId: string,
  chave: string,
  severidade: string,
): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(dispensarSchema, { regraId, chave, severidade })
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    await dispensarAlertaDoUsuario(u.id, workspaceId, v.data, hojeISO())
    return null
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function salvarConfigOrientador(
  workspaceId: string,
  input: ConfigOrientadorForm,
): Promise<ActionResult<ConfigOrientador>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(configSchema, input)
  if (!v.ok) return v.resultado
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    return salvarConfigDoUsuario(u.id, workspaceId, v.data)
  })
  if (r.ok) atualizar(workspaceId)
  return r
}

export async function restaurarConfigOrientador(workspaceId: string): Promise<ActionResult<ConfigOrientador>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    exigirUuid(workspaceId)
    return restaurarConfigDoUsuario(u.id, workspaceId)
  })
  if (r.ok) atualizar(workspaceId)
  return r
}
