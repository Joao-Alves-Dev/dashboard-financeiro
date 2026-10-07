import { getTranslations } from 'next-intl/server'
import { listarCategorias, listarContas } from '@/features/config/queries'
import { FluxoImportacao } from '@/features/importacao/fluxo-importacao'
import { Historico } from '@/features/importacao/historico'
import { listarImportacoes } from '@/features/importacao/queries'
import { obterWorkspace } from '@/features/workspaces/queries'

export default async function PaginaImportar({ params }: PageProps<'/w/[id]/importar'>) {
  const { id } = await params
  const ws = await obterWorkspace(id)
  const [contas, categorias, historico, t] = await Promise.all([
    listarContas(ws.id),
    listarCategorias(ws.id),
    listarImportacoes(ws.id),
    getTranslations('importacao'),
  ])

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <p className="text-sm text-muted-foreground">{t('descricao')}</p>
      </div>
      <FluxoImportacao
        workspaceId={ws.id}
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome }))}
      />
      <Historico workspaceId={ws.id} itens={historico} />
    </section>
  )
}
