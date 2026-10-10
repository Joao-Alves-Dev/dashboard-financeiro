'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SearchIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { agruparPorTema, filtrarDicas, type DicaResumo } from './filtrar'
import { TEMAS } from './tipos'

/**
 * Biblioteca "Aprenda": busca por título/resumo (filtro no cliente sobre a lista já carregada, ver `filtrar.ts`),
 * agrupada por tema. Recebe só os metadados; o texto completo fica em /orientacoes/[slug].
 */
export function BibliotecaAprenda({ workspaceId, dicas }: { workspaceId: string; dicas: DicaResumo[] }) {
  const t = useTranslations('orientador.biblioteca')
  const [termo, setTermo] = useState('')
  const filtradas = useMemo(() => filtrarDicas(dicas, termo), [dicas, termo])
  const grupos = useMemo(() => agruparPorTema(filtradas, TEMAS), [filtradas])
  const buscando = termo.trim() !== ''

  return (
    <section aria-labelledby="aprenda-titulo" className="flex flex-col gap-4">
      <header>
        <h2 id="aprenda-titulo" className="text-lg font-semibold">
          {t('titulo')}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t('descricao')}</p>
      </header>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="busca-aprenda">{t('buscaRotulo')}</Label>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="busca-aprenda"
            type="search"
            autoComplete="off"
            placeholder={t('buscaDica')}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="pr-10 pl-8"
          />
          {buscando ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('limpar')}
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
              onClick={() => setTermo('')}
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {buscando ? t('resultados', { n: filtradas.length }) : null}
        </p>
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
          {t('nenhum', { termo: termo.trim() })}
        </p>
      ) : (
        grupos.map((g) => (
          <div key={g.tema} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t(`temas.${g.tema}`)}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.dicas.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/w/${workspaceId}/orientacoes/${d.id}`}
                    className="flex h-full min-w-0 flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="font-medium break-words">{d.titulo}</span>
                    <span className="text-sm text-muted-foreground">{d.resumo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
