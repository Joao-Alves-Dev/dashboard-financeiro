import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Moldura reutilizável dos blocos do dashboard (título, descrição, ação opcional no cabeçalho, conteúdo).
 * Os cards das Tasks 13 (metas) e 16 (orientador) usam este componente.
 */
export function CardDashboard({
  titulo,
  descricao,
  acao,
  children,
  className,
  id,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  const idTitulo = id ? `${id}-titulo` : undefined
  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10', className)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={idTitulo} className="text-base leading-snug font-medium">
            {titulo}
          </h2>
          {descricao ? <p className="text-sm text-muted-foreground">{descricao}</p> : null}
        </div>
        {acao ? <div className="shrink-0 text-sm">{acao}</div> : null}
      </header>
      {children}
    </section>
  )
}

/** Placeholder do Suspense: mantém a altura do card para a página não pular quando o bloco chega. */
export function CardCarregando({ titulo, className }: { titulo: string; className?: string }) {
  return (
    <section
      aria-busy="true"
      aria-label={titulo}
      className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10', className)}
    >
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded bg-muted/60" />
    </section>
  )
}

/** Mensagem curta para cartões sem dados. */
export function EstadoVazio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>
}
