'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { FAVORECIDO_MAX } from './normalizar'

type Props = {
  id: string
  tipo: 'entrada' | 'saida'
  valor: string
  aoMudar: (v: string) => void
  /** Nomes já usados no workspace (grafia mais recente de cada favorecido). */
  sugestoes: string[]
  erro?: string
  autoFocus?: boolean
  className?: string
}

/** Campo opcional "Para quem / De quem" com autocomplete nativo (`<datalist>`), sem busca por tecla. */
export function CampoFavorecido({ id, tipo, valor, aoMudar, sugestoes, erro, autoFocus, className }: Props) {
  const t = useTranslations('lancamentos')
  const listaId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{tipo === 'saida' ? t('campos.favorecidoSaida') : t('campos.favorecidoEntrada')}</Label>
      <Input
        id={id}
        list={listaId}
        autoComplete="off"
        maxLength={FAVORECIDO_MAX + 40}
        placeholder={t('campos.favorecidoDica')}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={!!erro}
        autoFocus={autoFocus}
        className={cn(className)}
      />
      <datalist id={listaId}>
        {sugestoes.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  )
}
