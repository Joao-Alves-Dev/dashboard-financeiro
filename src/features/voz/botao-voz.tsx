'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CirculoMicrofone } from './telas-voz'
import { useVoz } from './voz-contexto'

/**
 * Entrada do lançamento por voz, no topo do painel: círculo de ~120px e rótulo grande.
 * Escuta, confirmação e erros acontecem na tela cheia do `VozProvider`.
 */
export function BotaoVoz() {
  const t = useTranslations('voz')
  const { iniciar, digitar, suportado, verificado } = useVoz()
  const semSuporte = verificado && !suportado

  return (
    <section
      aria-label={t('titulo')}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-card-foreground"
    >
      {semSuporte ? (
        <div className="flex w-full flex-col gap-3">
          <p role="status" className="text-xl leading-snug font-semibold">
            {t('semSuporte')}
          </p>
          <button
            type="button"
            onClick={digitar}
            className="h-14 rounded-xl bg-marca px-5 text-lg font-semibold text-marca-foreground hover:bg-marca/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {t('digitarFrase')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={iniciar}
            aria-label={t('botaoAria')}
            className="rounded-full outline-none transition-transform focus-visible:ring-4 focus-visible:ring-ring active:scale-95 motion-reduce:transition-none"
          >
            <CirculoMicrofone tamanho="grande" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <p className="text-2xl leading-tight font-bold">{t('botao')}</p>
            <p className="text-base leading-snug text-muted-foreground">{t('exemplo')}</p>
            <button
              type="button"
              onClick={digitar}
              className={cn(
                'mt-1 min-h-11 rounded-md text-base font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              )}
            >
              {t('digitarFrase')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
