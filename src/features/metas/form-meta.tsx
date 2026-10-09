'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { centavosParaCampo } from '@/lib/formato'
import { criarMeta, editarMeta } from './actions'

export type MetaEdicao = { id: string; nome: string; valorAlvoCentavos: number; dataAlvo: string }

type Props = {
  workspaceId: string
  /** Meta em edição; ausente = criação. */
  meta?: MetaEdicao
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}

export function FormMeta(props: Props) {
  const t = useTranslations('metas')
  return (
    <Dialog open={props.aberto} onOpenChange={props.aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{props.meta ? t('editarTitulo') : t('novaTitulo')}</DialogTitle>
          <DialogDescription>{t('formDescricao')}</DialogDescription>
        </DialogHeader>
        {/* O Popup desmonta ao fechar, então o formulário reinicia a cada abertura. */}
        <CorpoForm key={props.meta?.id ?? 'nova'} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function CorpoForm({ workspaceId, meta, aoMudar }: Props) {
  const t = useTranslations('metas')
  const tc = useTranslations('comum')
  const [nome, setNome] = useState(meta?.nome ?? '')
  const [valorAlvo, setValorAlvo] = useState(meta ? centavosParaCampo(meta.valorAlvoCentavos) : '')
  const [dataAlvo, setDataAlvo] = useState(meta?.dataAlvo ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCampos({})
    const entrada = { nome, valorAlvo, dataAlvo }
    iniciar(async () => {
      const r = meta ? await editarMeta(workspaceId, meta.id, entrada) : await criarMeta(workspaceId, entrada)
      if (r.ok) aoMudar(false)
      else {
        setErro(r.erro)
        setCampos(r.campos ?? {})
      }
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meta-nome">{t('campos.nome')}</Label>
        <Input
          id="meta-nome"
          autoComplete="off"
          placeholder={t('campos.nomePlaceholder')}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={!!campos.nome}
          autoFocus
        />
        {campos.nome && <p className="text-sm text-destructive">{campos.nome}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta-valor">{t('campos.valorAlvo')}</Label>
          <Input
            id="meta-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('campos.valorDica')}
            value={valorAlvo}
            onChange={(e) => setValorAlvo(e.target.value)}
            aria-invalid={!!campos.valorAlvo}
          />
          {campos.valorAlvo && <p className="text-sm text-destructive">{campos.valorAlvo}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meta-data">{t('campos.dataAlvo')}</Label>
          <Input
            id="meta-data"
            type="date"
            value={dataAlvo}
            onChange={(e) => setDataAlvo(e.target.value)}
            aria-invalid={!!campos.dataAlvo}
          />
          {campos.dataAlvo && <p className="text-sm text-destructive">{campos.dataAlvo}</p>}
        </div>
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
          {pendente ? tc('salvando') : tc('salvar')}
        </Button>
      </div>
    </form>
  )
}
