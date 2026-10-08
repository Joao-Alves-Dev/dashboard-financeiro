import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { hojeISO } from '@/lib/hoje'
import { exigirUsuario } from '@/lib/sessao'
import { inicioDoMes, rotuloMesLongo, somarMeses } from '@/features/dashboard/periodo'
import { obterWorkspace } from '@/features/workspaces/queries'
import { GradeOrcamento } from '@/features/orcamento/grade-orcamento'
import { lerMesInicial, QTD_MESES_GRADE } from '@/features/orcamento/grade'
import { listarGradeOrcamento } from '@/features/orcamento/queries'

export default async function PaginaOrcamento({ params, searchParams }: PageProps<'/w/[id]/orcamento'>) {
  const { id } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const t = await getTranslations('orcamento')
  const hoje = hojeISO()
  const mesInicial = lerMesInicial((await searchParams).mes, hoje)
  const grade = await listarGradeOrcamento(ws.id, mesInicial, QTD_MESES_GRADE)

  const base = `/w/${ws.id}/orcamento`
  const hrefMes = (m: string) => `${base}?mes=${m}`
  const ultimo = grade.meses[grade.meses.length - 1]
  const eHoje = mesInicial === inicioDoMes(hoje)

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <p className="text-sm text-muted-foreground">{t('descricao')}</p>
      </header>

      {grade.linhas.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <div>
            <p className="font-medium">{t('vazioTitulo')}</p>
            <p className="text-sm text-muted-foreground">{t('vazioTexto')}</p>
          </div>
          <Link href={`/w/${ws.id}/config`} className={buttonVariants({ variant: 'outline' })}>
            {t('irConfig')}
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label={t('navegacao')} className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium" aria-live="polite">
              {t('janela', { de: rotuloMesLongo(mesInicial), ate: rotuloMesLongo(ultimo) })}
            </p>
            <div className="flex items-center gap-2">
              <Link href={hrefMes(somarMeses(mesInicial, -1))} className={buttonVariants({ variant: 'outline' })}>
                <ChevronLeftIcon aria-hidden="true" />
                {t('mesAnterior')}
              </Link>
              {eHoje ? (
                <span aria-current="date" className={buttonVariants({ variant: 'secondary' })}>
                  {t('hoje')}
                </span>
              ) : (
                <Link href={base} className={buttonVariants({ variant: 'outline' })}>
                  {t('hoje')}
                </Link>
              )}
              <Link href={hrefMes(somarMeses(mesInicial, 1))} className={buttonVariants({ variant: 'outline' })}>
                {t('mesProximo')}
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </div>
          </nav>
          <GradeOrcamento
            key={mesInicial}
            workspaceId={ws.id}
            meses={grade.meses}
            linhas={grade.linhas}
            totais={grade.totais}
          />
        </>
      )}
    </section>
  )
}
