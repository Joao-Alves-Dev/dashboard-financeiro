import { getTranslations } from 'next-intl/server'
import { EmBreve } from '@/components/em-breve'
import { exigirUsuario } from '@/lib/sessao'
import { obterWorkspace } from '@/features/workspaces/queries'

// Placeholder: o orientador por regras e a biblioteca "Aprenda" chegam na Task 16.
export default async function PaginaOrientacoes({ params }: PageProps<'/w/[id]/orientacoes'>) {
  const { id } = await params
  await exigirUsuario()
  await obterWorkspace(id)
  const t = await getTranslations('nav')
  return <EmBreve titulo={t('orientacoes')} />
}
