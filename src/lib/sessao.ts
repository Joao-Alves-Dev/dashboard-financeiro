import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'

export type UsuarioSessao = { id: string; nome: string; isAnonymous: boolean }

/** Sessão atual ou null (sem redirecionar). Memoizada por requisição (layout, página e queries compartilham a leitura). */
export const obterUsuarioOpcional = cache(async (): Promise<UsuarioSessao | null> => {
  const sessao = await auth.api.getSession({ headers: await headers() })
  if (!sessao) return null
  const u = sessao.user as { id: string; name: string; isAnonymous?: boolean | null }
  return { id: u.id, nome: u.name, isAnonymous: Boolean(u.isAnonymous) }
})

/** Checagem real de autenticação: redireciona para /login sem sessão. */
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const u = await obterUsuarioOpcional()
  if (!u) redirect('/login')
  return u
}
