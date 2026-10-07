'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/lib/auth'
import type { ActionResult } from '@/lib/action-result'
import { errosPorCampo } from '@/lib/erros-zod'
import { loginSchema } from '@/features/auth/schemas'

export async function entrar(
  _anterior: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const t = await getTranslations()
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    senha: formData.get('senha'),
  })
  if (!parsed.success) {
    return { ok: false, erro: t('comum.erroGenerico'), campos: errosPorCampo(parsed.error, (c) => t(c)) }
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.senha },
      headers: await headers(),
    })
  } catch {
    return { ok: false, erro: t('login.erroCredenciais') }
  }
  redirect('/')
}

export async function sair(): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  redirect('/login')
}
