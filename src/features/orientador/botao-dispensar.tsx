'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { dispensarAlerta } from './actions'
import type { Alerta } from './tipos'

/** Dispensa o alerta até o fim do mês (a action revalida a página; o alerta some quando ela recarrega). */
export function BotaoDispensar({ workspaceId, alerta }: { workspaceId: string; alerta: Alerta }) {
  const t = useTranslations('orientador.alertas')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pendente}
        aria-label={t('dispensarAria', { titulo: alerta.titulo })}
        title={t('dispensarDica')}
        onClick={() => {
          setErro(null)
          iniciar(async () => {
            const r = await dispensarAlerta(workspaceId, alerta.regraId, alerta.chave, alerta.severidade)
            if (!r.ok) setErro(r.erro)
          })
        }}
      >
        {pendente ? t('dispensando') : t('dispensar')}
      </Button>
      {erro ? (
        <p role="alert" className="basis-full text-sm text-destructive">
          {erro}
        </p>
      ) : null}
    </>
  )
}
