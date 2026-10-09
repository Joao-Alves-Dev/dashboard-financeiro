'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardMeta, type AporteCard, type MetaCard } from './card-meta'
import { FormMeta } from './form-meta'

type Props = {
  workspaceId: string
  metas: MetaCard[]
  /** Aportes agrupados por id da meta (mais recentes primeiro). */
  aportesPorMeta: Record<string, AporteCard[]>
}

/** Cabeçalho com "Nova meta", estado vazio amigável e a lista de cards. */
export function ListaMetas({ workspaceId, metas, aportesPorMeta }: Props) {
  const t = useTranslations('metas')
  const [criando, setCriando] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {metas.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
          <div>
            <h2 className="font-medium">{t('vazioTitulo')}</h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t('vazioTexto')}</p>
          </div>
          <Button type="button" className="h-10 px-4" onClick={() => setCriando(true)}>
            <PlusIcon aria-hidden="true" />
            {t('criarPrimeira')}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Button type="button" className="h-10 px-4" onClick={() => setCriando(true)}>
              <PlusIcon aria-hidden="true" />
              {t('nova')}
            </Button>
          </div>
          <ul aria-label={t('lista')} className="grid gap-4 md:grid-cols-2">
            {metas.map((m) => (
              <li key={m.id} className="min-w-0">
                <CardMeta workspaceId={workspaceId} meta={m} aportes={aportesPorMeta[m.id] ?? []} />
              </li>
            ))}
          </ul>
        </>
      )}
      <FormMeta workspaceId={workspaceId} aberto={criando} aoMudar={setCriando} />
    </div>
  )
}
