'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import type { ActionResult } from '@/lib/action-result'
import { errosPorCampo } from '@/lib/erros-zod'
import { obterEdicao } from '@/lib/edicao'
import { cadastroSchema } from '@/features/auth/schemas'
import { cadastrarUsuario } from '@/features/auth/servico'

export async function cadastrar(
  _anterior: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const t = await getTranslations()
  const parsed = cadastroSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    senha: formData.get('senha'),
  })
  if (!parsed.success) {
    return { ok: false, erro: t('comum.erroGenerico'), campos: errosPorCampo(parsed.error, (c) => t(c)) }
  }

  const r = await cadastrarUsuario(parsed.data, {
    edicao: obterEdicao(),
    auth,
    headers: await headers(),
  })
  if (!r.ok) {
    if (r.motivo === 'cadastro_fechado') return { ok: false, erro: t('cadastro.erroFechado') }
    if (r.motivo === 'email_existe') {
      return { ok: false, erro: t('cadastro.erroEmailExiste'), campos: { email: t('cadastro.erroEmailExiste') } }
    }
    return { ok: false, erro: t('comum.erroGenerico') }
  }
  redirect('/novo')
}
