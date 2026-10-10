import { getTranslations } from 'next-intl/server'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { obterWorkspace } from '@/features/workspaces/queries'
import { carregarBiblioteca } from '@/features/orientador/biblioteca'
import { BibliotecaAprenda } from '@/features/orientador/biblioteca-aprenda'
import { ListaAlertas } from '@/features/orientador/lista-alertas'
import { listarAlertas } from '@/features/orientador/queries'

export default async function PaginaOrientacoes({ params }: PageProps<'/w/[id]/orientacoes'>) {
  const { id } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const t = await getTranslations('orientador')
  const alertas = await listarAlertas(ws.id, hojeISO())
  // Só metadados vão para o cliente (busca); o texto completo é carregado na página da dica.
  const dicas = carregarBiblioteca().map(({ id: dicaId, titulo, tema, resumo }) => ({ id: dicaId, titulo, tema, resumo }))

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{t('descricao')}</p>
      </header>
      <ListaAlertas workspaceId={ws.id} alertas={alertas} />
      <BibliotecaAprenda workspaceId={ws.id} dicas={dicas} />
    </section>
  )
}
