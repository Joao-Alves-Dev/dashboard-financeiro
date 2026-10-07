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
import { criarCategoria, editarCategoria, excluirCategoria } from './actions'
import { NATUREZAS } from './schemas'
import type { Categoria } from './servico'

export function CategoriasConfig({ workspaceId, categorias }: { workspaceId: string; categorias: Categoria[] }) {
  const t = useTranslations('config.categorias')
  const tc = useTranslations('comum')
  const [aberto, setAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Categoria | undefined>()
  const [paraExcluir, setParaExcluir] = useState<Categoria | null>(null)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="categorias-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="categorias-titulo" className="text-lg font-semibold">
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

      {categorias.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t('vazio')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('vazioDescricao')}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {categorias.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                <span aria-hidden className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: c.cor }} />
                <span className="break-words">{c.nome}</span>
                <Badge variant={c.natureza === 'receita' ? 'default' : 'secondary'}>
                  {t(`naturezas.${c.natureza as (typeof NATUREZAS)[number]}`)}
                </Badge>
              </p>
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
          <FormCategoria key={emEdicao?.id ?? 'nova'} workspaceId={workspaceId} categoria={emEdicao} aoMudar={setAberto} />
        </DialogContent>
      </Dialog>

      <ConfirmarDialogo
        aberto={paraExcluir !== null}
        aoMudar={(v) => {
          if (!v) setParaExcluir(null)
        }}
        titulo={t('excluirTitulo')}
        texto={t('excluirTexto', { nome: paraExcluir?.nome ?? '' })}
        rotuloConfirmar={tc('excluir')}
        aoConfirmar={async () => {
          if (!paraExcluir) return null
          const r = await excluirCategoria(workspaceId, paraExcluir.id)
          return r.ok ? null : r.erro
        }}
      />
    </section>
  )
}

function FormCategoria({
  workspaceId,
  categoria,
  aoMudar,
}: {
  workspaceId: string
  categoria?: Categoria
  aoMudar: (v: boolean) => void
}) {
  const t = useTranslations('config.categorias')
  const tc = useTranslations('comum')
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [natureza, setNatureza] = useState<string>(categoria?.natureza ?? 'despesa')
  const [cor, setCor] = useState(categoria?.cor ?? '#64748b')
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()
  const itens = NATUREZAS.map((v) => ({ value: v, label: t(`naturezas.${v}`) }))

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        setCampos({})
        iniciar(async () => {
          const entrada = { nome, natureza, cor } as Parameters<typeof criarCategoria>[1]
          const r = categoria
            ? await editarCategoria(workspaceId, categoria.id, entrada)
            : await criarCategoria(workspaceId, entrada)
          if (r.ok) aoMudar(false)
          else {
            setErro(r.erro)
            setCampos(r.campos ?? {})
          }
        })
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-nome">{t('nome')}</Label>
        <Input id="cat-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" autoFocus aria-invalid={!!campos.nome} />
        {campos.nome && <p className="text-sm text-destructive">{campos.nome}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('natureza')}</Label>
        <Select value={natureza} items={itens} onValueChange={(v) => setNatureza(v ?? 'despesa')}>
          <SelectTrigger className="w-full" aria-label={t('natureza')}>
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
        {campos.natureza && <p className="text-sm text-destructive">{campos.natureza}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-cor">{t('cor')}</Label>
        <input
          id="cat-cor"
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          className="h-9 w-16 cursor-pointer rounded-lg border border-input bg-transparent p-1"
        />
        {campos.cor && <p className="text-sm text-destructive">{campos.cor}</p>}
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
