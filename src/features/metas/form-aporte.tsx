'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hojeLocal } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import { registrarAporte } from './actions'

export type MetaAporte = { id: string; nome: string; guardado: number }

type Props = {
  workspaceId: string
  meta: MetaAporte
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}

export function FormAporte(props: Props) {
  const t = useTranslations('metas.aporte')
  return (
    <Dialog open={props.aberto} onOpenChange={props.aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('titulo', { meta: props.meta.nome })}</DialogTitle>
          <DialogDescription>{t('descricao')}</DialogDescription>
        </DialogHeader>
        <CorpoForm {...props} />
      </DialogContent>
    </Dialog>
  )
}

function CorpoForm({ workspaceId, meta, aoMudar }: Props) {
  const t = useTranslations('metas.aporte')
  const tc = useTranslations('comum')
  const [tipo, setTipo] = useState<'guardar' | 'retirar'>('guardar')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeLocal())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCampos({})
    // O valor digitado é sempre positivo; "Retirar" vira aporte negativo (sinal digitado é ignorado).
    const limpo = valor.trim().replace(/^[-+]\s*/, '')
    const enviado = tipo === 'retirar' && limpo !== '' ? `-${limpo}` : limpo
    iniciar(async () => {
      const r = await registrarAporte(workspaceId, meta.id, data, enviado, observacao)
      if (r.ok) aoMudar(false)
      else {
        setErro(r.erro)
        setCampos(r.campos ?? {})
      }
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div role="group" aria-label={t('tipo')} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(['guardar', 'retirar'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={tipo === v}
            onClick={() => setTipo(v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tipo === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(v)}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">{t('guardadoAtual', { valor: formatarBRL(meta.guardado) })}</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aporte-valor">{t('valor')}</Label>
          <Input
            id="aporte-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('valorDica')}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={!!campos.valor}
            autoFocus
          />
          {campos.valor && <p className="text-sm text-destructive">{campos.valor}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aporte-data">{t('data')}</Label>
          <Input
            id="aporte-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-invalid={!!campos.data}
          />
          {campos.data && <p className="text-sm text-destructive">{campos.data}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aporte-obs">{t('observacao')}</Label>
        <Input
          id="aporte-obs"
          autoComplete="off"
          placeholder={t('observacaoDica')}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          aria-invalid={!!campos.observacao}
        />
        {campos.observacao && <p className="text-sm text-destructive">{campos.observacao}</p>}
      </div>
      {erro && Object.keys(campos).length === 0 && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => aoMudar(false)}>
          {tc('cancelar')}
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? tc('salvando') : t('registrar')}
        </Button>
      </div>
    </form>
  )
}
