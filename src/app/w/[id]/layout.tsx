import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { exigirUsuario } from '@/lib/sessao'
import { listarWorkspacesDoUsuario, obterWorkspaceDoUsuario } from '@/features/workspaces/queries'
import { SeletorWorkspace } from '@/features/workspaces/seletor-workspace'
import { NavegacaoWorkspace } from '@/features/workspaces/navegacao-workspace'
import { sair } from '@/app/login/actions'

export default async function LayoutWorkspace({ children, params }: LayoutProps<'/w/[id]'>) {
  const { id } = await params
  const usuario = await exigirUsuario()
  const atual = await obterWorkspaceDoUsuario(usuario.id, id)
  const lista = await listarWorkspacesDoUsuario(usuario.id)
  const t = await getTranslations()

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3">
          <SeletorWorkspace
            atualId={atual.id}
            workspaces={lista.map((w) => ({ id: w.id, nome: w.nome, tipo: w.tipo }))}
          />
          <form action={sair}>
            <Button type="submit" variant="ghost" size="sm">
              {t('comum.sair')}
            </Button>
          </form>
        </div>
        <div className="mx-auto w-full max-w-6xl px-2 pt-2">
          <NavegacaoWorkspace workspaceId={atual.id} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</div>
    </div>
  )
}
