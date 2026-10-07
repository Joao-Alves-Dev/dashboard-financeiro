import { redirect } from 'next/navigation'
import { obterUsuarioOpcional } from '@/lib/sessao'
import { listarWorkspaces } from '@/features/workspaces/queries'

// A landing da demo é da Task 18; por ora só roteia.
export default async function Home() {
  const usuario = await obterUsuarioOpcional()
  if (!usuario) redirect('/login')
  const lista = await listarWorkspaces()
  if (lista.length === 0) redirect('/novo')
  redirect(`/w/${lista[0].id}`)
}
