'use server'

import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import type { ActionResult } from '@/lib/action-result'
import { errosPorCampo } from '@/lib/erros-zod'
import { exigirUsuario } from '@/lib/sessao'
import { novoWorkspaceSchema } from '@/features/workspaces/schemas'
import { criarWorkspaceParaUsuario } from '@/features/workspaces/queries'

export async function criarWorkspace(
  _anterior: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const t = await getTranslations()
  const parsed = novoWorkspaceSchema.safeParse({
    nome: formData.get('nome'),
    tipo: formData.get('tipo'),
  })
  if (!parsed.success) {
    return { ok: false, erro: t('comum.erroGenerico'), campos: errosPorCampo(parsed.error, (c) => t(c)) }
  }

  let id: string
  try {
    id = await criarWorkspaceParaUsuario(u.id, parsed.data.nome, parsed.data.tipo)
  } catch {
    return { ok: false, erro: t('comum.erroGenerico') }
  }
  redirect(`/w/${id}`)
}
