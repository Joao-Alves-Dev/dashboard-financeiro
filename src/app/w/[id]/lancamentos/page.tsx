import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { buttonVariants } from '@/components/ui/button'
import { listarCategorias, listarContas } from '@/features/config/queries'
import { FiltrosLancamentosForm } from '@/features/lancamentos/filtros-lancamentos'
import { listarLancamentos } from '@/features/lancamentos/queries'
import { lerFiltros, POR_PAGINA, type FiltrosLancamentos } from '@/features/lancamentos/schemas'
import { TabelaLancamentos } from '@/features/lancamentos/tabela-lancamentos'
import { obterWorkspace } from '@/features/workspaces/queries'

function hrefPagina(base: string, f: FiltrosLancamentos, pagina: number): string {
  const p = new URLSearchParams()
  if (f.de) p.set('de', f.de)
  if (f.ate) p.set('ate', f.ate)
  if (f.contaId) p.set('contaId', f.contaId)
  if (f.categoriaId) p.set('categoriaId', f.categoriaId)
  if (f.texto) p.set('texto', f.texto)
  if (pagina > 1) p.set('pagina', String(pagina))
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function PaginaLancamentos({ params, searchParams }: PageProps<'/w/[id]/lancamentos'>) {
  const { id } = await params
  const ws = await obterWorkspace(id)
  const filtros = lerFiltros(await searchParams)
  const [{ itens, total }, contas, categorias, t, tc] = await Promise.all([
    listarLancamentos(ws.id, filtros),
    listarContas(ws.id),
    listarCategorias(ws.id),
    getTranslations('lancamentos'),
    getTranslations('comum'),
  ])

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const base = `/w/${ws.id}/lancamentos`
  const temFiltro = Boolean(filtros.de || filtros.ate || filtros.contaId || filtros.categoriaId || filtros.texto)

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('titulo')}</h1>
      <FiltrosLancamentosForm
        key={`filtros-${JSON.stringify({ ...filtros, pagina: 1 })}`}
        filtros={filtros}
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, natureza: c.natureza }))}
      />
      <TabelaLancamentos
        key={`tabela-${JSON.stringify(filtros)}`}
        workspaceId={ws.id}
        tipoWorkspace={ws.tipo}
        itens={itens}
        total={total}
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        categorias={categorias.map((c) => ({ id: c.id, nome: c.nome, natureza: c.natureza }))}
        temFiltro={temFiltro}
      />
      {totalPaginas > 1 && (
        <nav aria-label={tc('pagina', { pagina: filtros.pagina, total: totalPaginas })} className="flex items-center justify-between gap-2">
          {filtros.pagina > 1 ? (
            <Link href={hrefPagina(base, filtros, filtros.pagina - 1)} className={buttonVariants({ variant: 'outline' })}>
              {tc('anterior')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            {tc('pagina', { pagina: filtros.pagina, total: totalPaginas })}
          </span>
          {filtros.pagina < totalPaginas ? (
            <Link href={hrefPagina(base, filtros, filtros.pagina + 1)} className={buttonVariants({ variant: 'outline' })}>
              {tc('proxima')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </section>
  )
}
