import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeftIcon } from 'lucide-react'
import { exigirUsuario } from '@/lib/sessao'
import { obterWorkspace } from '@/features/workspaces/queries'
import { obterDica } from '@/features/orientador/biblioteca'
import { TextoDica } from '@/features/orientador/texto-dica'

export default async function PaginaDica({ params }: PageProps<'/w/[id]/orientacoes/[slug]'>) {
  const { id, slug } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const dica = obterDica(slug)
  if (!dica) notFound()
  const t = await getTranslations('orientador')

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/w/${ws.id}/orientacoes`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t('dica.voltar')}
      </Link>
      <TextoDica dica={dica} />
    </div>
  )
}
