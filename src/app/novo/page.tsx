import { exigirUsuario } from '@/lib/sessao'
import { FormNovoWorkspace } from '@/features/workspaces/form-novo-workspace'

export default async function PaginaNovoWorkspace() {
  await exigirUsuario()
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <FormNovoWorkspace />
    </main>
  )
}
