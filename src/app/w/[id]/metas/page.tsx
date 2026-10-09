import { getTranslations } from 'next-intl/server'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { obterWorkspace } from '@/features/workspaces/queries'
import type { AporteCard } from '@/features/metas/card-meta'
import { ListaMetas } from '@/features/metas/lista-metas'
import { listarAportes, listarMetas } from '@/features/metas/queries'

export default async function PaginaMetas({ params }: PageProps<'/w/[id]/metas'>) {
  const { id } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const t = await getTranslations('metas')
  const hoje = hojeISO()
  const [metas, aportes] = await Promise.all([listarMetas(ws.id, hoje), listarAportes(ws.id)])

  const aportesPorMeta: Record<string, AporteCard[]> = {}
  for (const a of aportes) {
    ;(aportesPorMeta[a.metaId] ??= []).push({
      id: a.id,
      data: a.data,
      valorCentavos: a.valorCentavos,
      observacao: a.observacao,
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{t('descricao')}</p>
      </header>
      <ListaMetas
        workspaceId={ws.id}
        metas={metas.map((m) => ({
          id: m.id,
          nome: m.nome,
          valorAlvoCentavos: m.valorAlvoCentavos,
          dataAlvo: m.dataAlvo,
          guardado: m.guardado,
          calculo: m.calculo,
        }))}
        aportesPorMeta={aportesPorMeta}
      />
    </section>
  )
}
