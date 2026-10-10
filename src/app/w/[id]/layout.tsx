import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { BarraInferior } from '@/components/barra-inferior'
import { exigirUsuario } from '@/lib/sessao'
import { hojeISO } from '@/lib/hoje'
import { listarWorkspacesDoUsuario, obterWorkspaceDoUsuario } from '@/features/workspaces/queries'
import { SeletorWorkspace } from '@/features/workspaces/seletor-workspace'
import { NavegacaoWorkspace } from '@/features/workspaces/navegacao-workspace'
import { MenuMais } from '@/features/workspaces/menu-mais'
import { listarCategoriasDoUsuario, listarContasDoUsuario, listarRegrasDoUsuario } from '@/features/config/servico'
import { listarFavorecidosDoUsuario } from '@/features/favorecido/servico'
import { categoriasFrequentesDoUsuario } from '@/features/lancamentos/servico'
import { escolherContaPadrao } from '@/features/lancamentos/categorias-frequentes'
import { BotaoLancamentoRapido, LancamentoRapidoProvider } from '@/features/lancamentos/lancamento-rapido-contexto'
import { VozProvider } from '@/features/voz/voz-contexto'
import { sair } from '@/app/login/actions'

export default async function LayoutWorkspace({ children, params }: LayoutProps<'/w/[id]'>) {
  const { id } = await params
  const usuario = await exigirUsuario()
  const atual = await obterWorkspaceDoUsuario(usuario.id, id)
  const t = await getTranslations()
  const jar = await cookies()
  const [lista, contas, categorias, frequentes, favorecidos, regras] = await Promise.all([
    listarWorkspacesDoUsuario(usuario.id),
    listarContasDoUsuario(usuario.id, atual.id),
    listarCategoriasDoUsuario(usuario.id, atual.id),
    categoriasFrequentesDoUsuario(usuario.id, atual.id, hojeISO()),
    listarFavorecidosDoUsuario(usuario.id, atual.id),
    listarRegrasDoUsuario(usuario.id, atual.id),
  ])
  // O cookie é do cliente: só vale se o id for de uma conta deste workspace (senão, a primeira).
  const contaPadraoId = escolherContaPadrao(contas, jar.get(`ultima_conta_${atual.id}`)?.value)
  const opcao = (c: { id: string; nome: string; natureza: string }) => ({ id: c.id, nome: c.nome, natureza: c.natureza })

  return (
    <LancamentoRapidoProvider
      workspaceId={atual.id}
      contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
      categorias={categorias.map(opcao)}
      frequentes={frequentes.map(opcao)}
      favorecidos={favorecidos.map((f) => f.nome)}
      contaPadraoId={contaPadraoId}
    >
      <VozProvider regras={regras.map((r) => ({ padrao: r.padrao, categoriaId: r.categoriaId, prioridade: r.prioridade }))}>
      <div className="flex flex-1 flex-col">
        <header className="border-b bg-background pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pt-3">
            <SeletorWorkspace
              atualId={atual.id}
              workspaces={lista.map((w) => ({ id: w.id, nome: w.nome, tipo: w.tipo }))}
            />
            <div className="flex items-center gap-1">
              <BotaoLancamentoRapido />
              <MenuMais workspaceId={atual.id} />
              <form action={sair}>
                <Button type="submit" variant="ghost" size="sm" className="max-md:min-h-11 max-md:px-3 max-md:text-sm">
                  {t('comum.sair')}
                </Button>
              </form>
            </div>
          </div>
          {/* No celular a barra inferior substitui esta navegação. */}
          <div className="mx-auto hidden w-full max-w-6xl px-2 pt-2 md:block">
            <NavegacaoWorkspace workspaceId={atual.id} />
          </div>
          <div className="h-3 md:hidden" />
        </header>
        {/* pb: espaço da barra inferior (4rem + área segura) para o conteúdo não ficar atrás dela. */}
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-4">
          {children}
        </div>
        <BarraInferior workspaceId={atual.id} />
      </div>
      </VozProvider>
    </LancamentoRapidoProvider>
  )
}
