'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { centavosParaCampo, hojeLocal } from '@/lib/formato'
import { criarLancamento, editarLancamento } from './actions'
import type { Lancamento } from './servico'

export type OpcaoConta = { id: string; nome: string }
export type OpcaoCategoria = { id: string; nome: string; natureza: string }

const SEM_CATEGORIA = '__nenhuma'

type Props = {
  workspaceId: string
  tipoWorkspace: string
  contas: OpcaoConta[]
  categorias: OpcaoCategoria[]
  /** Lançamento em edição; ausente = criação. */
  lancamento?: Lancamento
  aberto: boolean
  aoMudar: (aberto: boolean) => void
}

export function FormLancamento(props: Props) {
  const t = useTranslations('lancamentos')
  return (
    <Dialog open={props.aberto} onOpenChange={props.aoMudar}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{props.lancamento ? t('editarTitulo') : t('novoTitulo')}</DialogTitle>
          <DialogDescription>{t('formDescricao')}</DialogDescription>
        </DialogHeader>
        {/* O Popup desmonta ao fechar, então o formulário reinicia a cada abertura. */}
        <CorpoForm key={props.lancamento?.id ?? 'novo'} {...props} />
      </DialogContent>
    </Dialog>
  )
}

function CorpoForm({ workspaceId, tipoWorkspace, contas, categorias, lancamento, aoMudar }: Props) {
  const t = useTranslations('lancamentos')
  const tc = useTranslations('comum')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>(lancamento && lancamento.valorCentavos > 0 ? 'entrada' : 'saida')
  const [valor, setValor] = useState(lancamento ? centavosParaCampo(Math.abs(lancamento.valorCentavos)) : '')
  const [data, setData] = useState(lancamento?.data ?? hojeLocal())
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '')
  const [contaId, setContaId] = useState(lancamento?.contaId ?? (contas.length === 1 ? contas[0].id : ''))
  const [categoriaId, setCategoriaId] = useState(lancamento?.categoriaId ?? SEM_CATEGORIA)
  const [status, setStatus] = useState<'efetivado' | 'pendente'>(
    lancamento?.status === 'pendente' ? 'pendente' : 'efetivado',
  )
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()

  const itensConta = contas.map((c) => ({ value: c.id, label: c.nome }))
  const itensCategoria = [
    { value: SEM_CATEGORIA, label: t('semCategoria') },
    ...categorias.map((c) => ({ value: c.id, label: c.nome })),
  ]
  const itensStatus = [
    { value: 'efetivado', label: t('status.efetivado') },
    { value: 'pendente', label: t('status.pendente') },
  ]

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCampos({})
    const entrada = {
      valor,
      tipo,
      data,
      descricao,
      contaId,
      categoriaId: categoriaId === SEM_CATEGORIA ? '' : categoriaId,
      status,
    }
    iniciar(async () => {
      const r = lancamento
        ? await editarLancamento(workspaceId, lancamento.id, entrada)
        : await criarLancamento(workspaceId, entrada)
      if (r.ok) {
        aoMudar(false)
      } else {
        setErro(r.erro)
        setCampos(r.campos ?? {})
      }
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      <div role="group" aria-label={t('campos.tipo')} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(['saida', 'entrada'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={tipo === v}
            onClick={() => setTipo(v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tipo === v
                ? v === 'entrada'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tipo.${v}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lanc-valor">{t('campos.valor')}</Label>
          <Input
            id="lanc-valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t('campos.valorDica')}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={!!campos.valor}
            autoFocus
          />
          {campos.valor && <p className="text-sm text-destructive">{campos.valor}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lanc-data">{t('campos.data')}</Label>
          <Input
            id="lanc-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-invalid={!!campos.data}
          />
          {campos.data && <p className="text-sm text-destructive">{campos.data}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lanc-descricao">{t('campos.descricao')}</Label>
        <Input
          id="lanc-descricao"
          autoComplete="off"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          aria-invalid={!!campos.descricao}
        />
        {campos.descricao && <p className="text-sm text-destructive">{campos.descricao}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('campos.conta')}</Label>
        <Select value={contaId} items={itensConta} onValueChange={(v) => setContaId(v ?? '')}>
          <SelectTrigger className="w-full" aria-label={t('campos.conta')} aria-invalid={!!campos.contaId}>
            <SelectValue placeholder={t('campos.conta')} />
          </SelectTrigger>
          <SelectContent>
            {itensConta.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campos.contaId && <p className="text-sm text-destructive">{campos.contaId}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t('campos.categoria')}</Label>
        <Select value={categoriaId} items={itensCategoria} onValueChange={(v) => setCategoriaId(v ?? SEM_CATEGORIA)}>
          <SelectTrigger className="w-full" aria-label={t('campos.categoria')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itensCategoria.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campos.categoriaId && <p className="text-sm text-destructive">{campos.categoriaId}</p>}
      </div>

      {tipoWorkspace === 'empresa' && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('campos.status')}</Label>
          <Select value={status} items={itensStatus} onValueChange={(v) => setStatus(v === 'pendente' ? 'pendente' : 'efetivado')}>
            <SelectTrigger className="w-full" aria-label={t('campos.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {itensStatus.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {erro && (
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
