import { getTranslations } from 'next-intl/server'
import { ABAS, type Aba } from '@/features/config/abas'
import { AbasConfig } from '@/features/config/abas-config'
import { CategoriasConfig } from '@/features/config/categorias-config'
import { ContasConfig } from '@/features/config/contas-config'
import { listarCategorias, listarContas, listarRegras } from '@/features/config/queries'
import { RegrasConfig } from '@/features/config/regras-config'
import { obterWorkspace } from '@/features/workspaces/queries'

export default async function PaginaConfig({ params, searchParams }: PageProps<'/w/[id]/config'>) {
  const { id } = await params
  const ws = await obterWorkspace(id)
  const { aba } = await searchParams
  const inicial: Aba = ABAS.find((a) => a === aba) ?? 'contas'
  const [contas, categorias, regras, t] = await Promise.all([
    listarContas(ws.id),
    listarCategorias(ws.id),
    listarRegras(ws.id),
    getTranslations('config'),
  ])

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
      <AbasConfig
        inicial={inicial}
        contas={<ContasConfig workspaceId={ws.id} contas={contas} />}
        categorias={<CategoriasConfig workspaceId={ws.id} categorias={categorias} />}
        regras={<RegrasConfig workspaceId={ws.id} regras={regras} categorias={categorias} />}
      />
    </section>
  )
}
