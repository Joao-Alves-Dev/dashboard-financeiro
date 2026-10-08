import { redirect } from 'next/navigation'
import { FormLogin } from '@/features/auth/form-login'
import { obterUsuarioOpcional } from '@/lib/sessao'
import { obterEdicao, recursos } from '@/lib/edicao'

export default async function PaginaLogin() {
  if (await obterUsuarioOpcional()) redirect('/')
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <FormLogin cadastroAberto={recursos(obterEdicao()).cadastroAberto} />
    </main>
  )
}
