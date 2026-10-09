import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { exigirUsuario } from '@/lib/sessao'
import { hojeISO } from '@/lib/hoje'
import { obterWorkspace } from '@/features/workspaces/queries'
import { CardCarregando } from '@/features/dashboard/card-dashboard'
import { KpisBloco } from '@/features/dashboard/kpis'
import { GraficoMensalBloco } from '@/features/dashboard/grafico-mensal'
import { GraficoCategoriasBloco } from '@/features/dashboard/grafico-categorias'
import { OrcamentoResumoBloco } from '@/features/dashboard/orcamento-resumo'
import { UltimosLancamentosBloco } from '@/features/dashboard/ultimos-lancamentos'
import { APagarReceberBloco } from '@/features/dashboard/a-pagar-receber'
import { MetasResumoBloco } from '@/features/metas/metas-resumo'
import { DashboardVazio } from '@/features/dashboard/vazio'
import { obterExisteLancamento } from '@/features/dashboard/queries'

export default async function PaginaWorkspace({ params }: PageProps<'/w/[id]'>) {
  const { id } = await params
  await exigirUsuario()
  const ws = await obterWorkspace(id)
  const t = await getTranslations('dashboard')
  // "Hoje" em America/Sao_Paulo (src/lib/hoje.ts): define o mês corrente e a janela de 30 dias.
  const hoje = hojeISO()

  if (!(await obterExisteLancamento(ws.id))) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
        <DashboardVazio ws={ws.id} />
      </div>
    )
  }

  const carregando = t('carregando')
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>

      <Suspense fallback={<div className="h-28 animate-pulse rounded-xl bg-muted/60" aria-busy="true" aria-label={carregando} />}>
        <KpisBloco ws={ws.id} hoje={hoje} />
      </Suspense>

      {/* Cada bloco é independente (Suspense próprio): a página não espera o mais lento. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Suspense fallback={<CardCarregando titulo={carregando} />}>
            <GraficoMensalBloco ws={ws.id} hoje={hoje} />
          </Suspense>
        </div>

        {ws.tipo === 'empresa' ? (
          <div className="lg:col-span-2">
            <Suspense fallback={<CardCarregando titulo={carregando} />}>
              <APagarReceberBloco ws={ws.id} hoje={hoje} />
            </Suspense>
          </div>
        ) : null}

        {/*
          PONTO DE EXTENSÃO: novos cards entram aqui, cada um em <Suspense> próprio, usando CardDashboard.
          Task 16 adiciona o card de alertas do orientador (`lg:col-span-2` para largura total).
        */}
        <div className="lg:col-span-2">
          <Suspense fallback={<CardCarregando titulo={carregando} />}>
            <MetasResumoBloco ws={ws.id} hoje={hoje} />
          </Suspense>
        </div>

        <Suspense fallback={<CardCarregando titulo={carregando} />}>
          <GraficoCategoriasBloco ws={ws.id} hoje={hoje} />
        </Suspense>
        <Suspense fallback={<CardCarregando titulo={carregando} />}>
          <OrcamentoResumoBloco ws={ws.id} hoje={hoje} />
        </Suspense>

        <div className="lg:col-span-2">
          <Suspense fallback={<CardCarregando titulo={carregando} />}>
            <UltimosLancamentosBloco ws={ws.id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
