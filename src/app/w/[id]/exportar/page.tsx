import { exigirUsuario } from '@/lib/sessao'
import { hojeISO } from '@/lib/hoje'
import { inicioDoMes } from '@/features/dashboard/periodo'
import { lerParamsTela } from '@/features/exportacao/schemas'
import { PaginaExportar } from '@/features/exportacao/pagina-exportar'
import { listarFavorecidos } from '@/features/favorecido/queries'
import { obterWorkspace } from '@/features/workspaces/queries'

export default async function PaginaExportarLista({ params, searchParams }: PageProps<'/w/[id]/exportar'>) {
  const { id } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const hoje = hojeISO()
  const inicial = lerParamsTela(await searchParams, hoje, inicioDoMes(hoje))
  const favorecidos = await listarFavorecidos(ws.id)

  return (
    <PaginaExportar
      workspaceId={ws.id}
      favorecidos={favorecidos.map((f) => ({ chave: f.chave, nome: f.nome }))}
      hoje={hoje}
      inicial={inicial}
    />
  )
}
