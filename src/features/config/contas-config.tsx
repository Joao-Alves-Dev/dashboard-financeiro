'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ConfirmarDialogo } from '@/components/confirmar-dialogo'
import { centavosParaCampo } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { criarConta, editarConta, excluirConta } from './actions'
import { TIPOS_CONTA } from './schemas'
import type { ContaComContagem } from './servico'

export function ContasConfig({ workspaceId, contas }: { workspaceId: string; contas: ContaComContagem[] }) {
  const t = useTranslations('config.contas')
  const tc = useTranslations('comum')
  const [aberto, setAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<ContaComContagem | undefined>()
  const [paraExcluir, setParaExcluir] = useState<ContaComContagem | null>(null)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="contas-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="contas-titulo" className="text-lg font-semibold">
            {t('titulo')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('descricao')}</p>
        </div>
        <Button
          onClick={() => {
            setEmEdicao(undefined)
            setAberto(true)
          }}
        >
          <PlusIcon />
          {t('nova')}
        </Button>
      </div>

      {contas.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t('vazio')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('vazioDescricao')}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {contas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="break-words">{c.nome}</span>
                  <Badge variant="secondary">{t(`tipos.${c.tipo as (typeof TIPOS_CONTA)[number]}`)}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('saldoInicial')}: {formatarBRL(c.saldoInicialCentavos)} · {t('qtdLancamentos', { n: c.qtdLancamentos })}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${tc('editar')}: ${c.nome}`}
                  onClick={() => {
                    setEmEdicao(c)
                    setAberto(true)
                  }}
                >
                  <PencilIcon />
                  {tc('editar')}
                </Button>
                <Button size="sm" variant="ghost" aria-label={`${tc('excluir')}: ${c.nome}`} onClick={() => setParaExcluir(c)}>
                  <Trash2Icon />
                  {tc('excluir')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{emEdicao ? t('editarTitulo') : t('novaTitulo')}</DialogTitle>
            <DialogDescription>{t('descricao')}</DialogDescription>
          </DialogHeader>
          <FormConta key={emEdicao?.id ?? 'nova'} workspaceId={workspaceId} conta={emEdicao} aoMudar={setAberto} />
        </DialogContent>
      </Dialog>

      <ConfirmarDialogo
        aberto={paraExcluir !== null}
        aoMudar={(v) => {
          if (!v) setParaExcluir(null)
        }}
        titulo={t('excluirTitulo')}
        texto={
          paraExcluir && paraExcluir.qtdLancamentos > 0
            ? t('excluirTextoComLancamentos', { nome: paraExcluir.nome, n: paraExcluir.qtdLancamentos })
            : t('excluirTextoVazia', { nome: paraExcluir?.nome ?? '' })
        }
        rotuloConfirmar={
          paraExcluir && paraExcluir.qtdLancamentos > 0
            ? t('confirmarExclusao', { n: paraExcluir.qtdLancamentos })
            : tc('excluir')
        }
        aoConfirmar={async () => {
          if (!paraExcluir) return null
          const r = await excluirConta(workspaceId, paraExcluir.id, paraExcluir.qtdLancamentos > 0)
          return r.ok ? null : r.erro
        }}
      />
    </section>
  )
}

function FormConta({
  workspaceId,
  conta,
  aoMudar,
}: {
  workspaceId: string
  conta?: ContaComContagem
  aoMudar: (v: boolean) => void
}) {
  const t = useTranslations('config.contas')
  const tc = useTranslations('comum')
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [tipo, setTipo] = useState<string>(conta?.tipo ?? 'corrente')
  const [saldo, setSaldo] = useState(conta ? centavosParaCampo(conta.saldoInicialCentavos) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()
  const itens = TIPOS_CONTA.map((v) => ({ value: v, label: t(`tipos.${v}`) }))

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        setCampos({})
        iniciar(async () => {
          const entrada = { nome, tipo, saldoInicial: saldo } as Parameters<typeof criarConta>[1]
          const r = conta ? await editarConta(workspaceId, conta.id, entrada) : await criarConta(workspaceId, entrada)
          if (r.ok) aoMudar(false)
          else {
            setErro(r.erro)
            setCampos(r.campos ?? {})
          }
        })
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conta-nome">{t('nome')}</Label>
        <Input
          id="conta-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t('nomePlaceholder')}
          autoComplete="off"
          autoFocus
          aria-invalid={!!campos.nome}
        />
        {campos.nome && <p className="text-sm text-destructive">{campos.nome}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('tipo')}</Label>
        <Select value={tipo} items={itens} onValueChange={(v) => setTipo(v ?? 'corrente')}>
          <SelectTrigger className="w-full" aria-label={t('tipo')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itens.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campos.tipo && <p className="text-sm text-destructive">{campos.tipo}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conta-saldo">{t('saldoInicial')}</Label>
        <Input
          id="conta-saldo"
          inputMode="decimal"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          autoComplete="off"
          aria-invalid={!!campos.saldoInicial}
        />
        <p className="text-xs text-muted-foreground">{t('saldoInicialDica')}</p>
        {campos.saldoInicial && <p className="text-sm text-destructive">{campos.saldoInicial}</p>}
      </div>
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
