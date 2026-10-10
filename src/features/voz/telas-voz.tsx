'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircleIcon, MicIcon } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const BOTAO_PRIMARIO = 'h-16 w-full bg-marca text-xl font-semibold text-marca-foreground hover:bg-marca/90'
const BOTAO_SECUNDARIO = 'h-14 w-full text-lg'
const LINK_DISCRETO =
  'min-h-12 rounded-md px-3 text-base font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

/** Cabeçalho comum das telas cheias: o título também dá nome acessível ao diálogo. */
export function CabecalhoVoz({ descricao }: { descricao?: string }) {
  const t = useTranslations('voz')
  return (
    <header className="mx-auto w-full max-w-md px-6 pt-5">
      <DialogTitle className="text-base font-medium text-muted-foreground">{t('titulo')}</DialogTitle>
      <DialogDescription className="sr-only">{descricao ?? t('titulo')}</DialogDescription>
    </header>
  )
}

/** O círculo de microfone (o mesmo desenho do botão do painel e da tela de escuta). */
export function CirculoMicrofone({
  tamanho,
  pulsando = false,
  className,
}: {
  tamanho: 'grande' | 'tela'
  pulsando?: boolean
  className?: string
}) {
  const medida = tamanho === 'grande' ? 'size-[7.5rem]' : 'size-36'
  return (
    <span aria-hidden className={cn('relative grid shrink-0 place-items-center', className)}>
      {pulsando && (
        <span
          className={cn('absolute rounded-full bg-marca/30 motion-safe:animate-ping', tamanho === 'grande' ? 'size-[7.5rem]' : 'size-36')}
        />
      )}
      <span
        className={cn(
          'relative grid place-items-center rounded-full bg-marca text-marca-foreground shadow-lg ring-8 ring-marca/20',
          medida,
        )}
      >
        <MicIcon className={tamanho === 'grande' ? 'size-12' : 'size-16'} strokeWidth={2.25} />
      </span>
    </span>
  )
}

export function TelaOuvindo({
  ouvindo,
  parcial,
  aoParar,
  aoCancelar,
  aoDigitar,
}: {
  ouvindo: boolean
  parcial: string
  aoParar: () => void
  aoCancelar: () => void
  aoDigitar: () => void
}) {
  const t = useTranslations('voz')
  return (
    <>
      <CabecalhoVoz descricao={t('ouvindoDica')} />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        {/* Margem extra: o halo do pulso não pode ser cortado nas bordas. */}
        <CirculoMicrofone tamanho="tela" pulsando={ouvindo} className="m-4" />
        <p role="status" aria-live="polite" className="text-3xl font-semibold">
          {ouvindo ? t('ouvindo') : t('aguardando')}
        </p>
        <p aria-live="polite" className="min-h-24 max-w-prose text-3xl leading-snug font-medium break-words">
          {parcial || <span className="text-xl font-normal text-muted-foreground">{t('ouvindoDica')}</span>}
        </p>
        <p className="text-sm text-muted-foreground">{t('tempoAviso')}</p>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-6 pb-6">
        <Button type="button" className={BOTAO_PRIMARIO} onClick={aoParar}>
          {t('parar')}
        </Button>
        <Button type="button" variant="outline" className={BOTAO_SECUNDARIO} onClick={aoCancelar}>
          {t('cancelar')}
        </Button>
        <button type="button" className={cn(LINK_DISCRETO, 'self-center')} onClick={aoDigitar}>
          {t('digitarFrase')}
        </button>
      </div>
    </>
  )
}

export function TelaDigitar({
  semSuporte,
  aoEnviar,
  aoCancelar,
}: {
  semSuporte: boolean
  aoEnviar: (texto: string) => void
  aoCancelar: () => void
}) {
  const t = useTranslations('voz')
  const [texto, setTexto] = useState('')
  return (
    <>
      <CabecalhoVoz descricao={t('digiteFraseDica')} />
      <form
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6"
        onSubmit={(e) => {
          e.preventDefault()
          aoEnviar(texto)
        }}
      >
        {semSuporte && (
          <p role="status" className="rounded-xl bg-muted p-4 text-lg font-medium">
            {t('semSuporte')}
          </p>
        )}
        <Label htmlFor="voz-frase" className="text-xl font-semibold">
          {t('digiteFrase')}
        </Label>
        <Input
          id="voz-frase"
          autoFocus
          autoComplete="off"
          enterKeyHint="go"
          className="h-16 text-xl md:text-xl"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p className="text-base text-muted-foreground">{t('digiteFraseDica')}</p>
        <Button type="submit" className={BOTAO_PRIMARIO}>
          {t('continuar')}
        </Button>
        <Button type="button" variant="outline" className={BOTAO_SECUNDARIO} onClick={aoCancelar}>
          {t('cancelar')}
        </Button>
      </form>
    </>
  )
}

export function TelaErro({
  mensagem,
  texto,
  podeFalar,
  aoFalarDeNovo,
  aoDigitar,
  aoCancelar,
}: {
  mensagem: string
  texto: string | null
  podeFalar: boolean
  aoFalarDeNovo: () => void
  aoDigitar: () => void
  aoCancelar: () => void
}) {
  const t = useTranslations('voz')
  return (
    <>
      <CabecalhoVoz descricao={mensagem} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6">
        <AlertCircleIcon aria-hidden className="size-14 text-destructive" />
        <p role="alert" className="text-3xl leading-snug font-semibold">
          {mensagem}
        </p>
        {texto && <p className="text-xl text-muted-foreground">{t('ouvi', { texto: `“${texto}”` })}</p>}
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-6 pb-6">
        {podeFalar && (
          <Button type="button" className={BOTAO_PRIMARIO} onClick={aoFalarDeNovo}>
            {t('falarDeNovo')}
          </Button>
        )}
        <Button
          type="button"
          variant={podeFalar ? 'outline' : 'default'}
          className={podeFalar ? BOTAO_SECUNDARIO : BOTAO_PRIMARIO}
          onClick={aoDigitar}
        >
          {t('digitarFrase')}
        </Button>
        <button type="button" className={cn(LINK_DISCRETO, 'self-center')} onClick={aoCancelar}>
          {t('cancelar')}
        </button>
      </div>
    </>
  )
}
