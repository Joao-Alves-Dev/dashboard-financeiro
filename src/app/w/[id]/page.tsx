import { getTranslations } from 'next-intl/server'
import { obterWorkspace } from '@/features/workspaces/queries'

// Placeholder: o dashboard real é da Task 10.
export default async function PaginaWorkspace({ params }: PageProps<'/w/[id]'>) {
  const { id } = await params
  const ws = await obterWorkspace(id)
  const t = await getTranslations('workspace')
  return (
    <h1 className="text-2xl font-semibold tracking-tight">{t('bemVindo', { nome: ws.nome })}</h1>
  )
}
