import { redirect } from 'next/navigation'
import { FormCadastro } from '@/features/auth/form-cadastro'
import { obterUsuarioOpcional } from '@/lib/sessao'
import { obterEdicao, recursos } from '@/lib/edicao'

export default async function PaginaCadastro() {
  if (!recursos(obterEdicao()).cadastroAberto) redirect('/login')
  if (await obterUsuarioOpcional()) redirect('/')
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <FormCadastro />
    </main>
  )
}
