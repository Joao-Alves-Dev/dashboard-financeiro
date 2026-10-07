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
import { criarRegra, editarRegra, excluirRegra } from './actions'
import type { Categoria, RegraDb } from './servico'

export function RegrasConfig({
  workspaceId,
  regras,
  categorias,
}: {
  workspaceId: string
  regras: RegraDb[]
  categorias: Categoria[]
}) {
  const t = useTranslations('config.regras')
  const tc = useTranslations('comum')
  const [aberto, setAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<RegraDb | undefined>()
  const [paraExcluir, setParaExcluir] = useState<RegraDb | null>(null)
  const nomeCategoria = new Map(categorias.map((c) => [c.id, c.nome]))

  return (
    <section className="flex flex-col gap-4" aria-labelledby="regras-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-prose">
          <h2 id="regras-titulo" className="text-lg font-semibold">
            {t('titulo')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('descricao')}</p>
        </div>
        <Button
          disabled={categorias.length === 0}
          onClick={() => {
            setEmEdicao(undefined)
            setAberto(true)
          }}
        >
          <PlusIcon />
          {t('nova')}
        </Button>
      </div>
      {categorias.length === 0 && <p className="text-sm text-muted-foreground">{t('semCategorias')}</p>}

      {regras.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">{t('vazio')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('vazioDescricao')}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {regras.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <p className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{t('contem')}</span>
                <code className="break-all rounded bg-muted px-1.5 py-0.5 text-sm">{r.padrao}</code>
                <span aria-hidden>→</span>
                <span className="font-medium">{nomeCategoria.get(r.categoriaId) ?? '—'}</span>
                <Badge variant="outline">
                  {t('prioridade')}: {r.prioridade}
                </Badge>
              </p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`${tc('editar')}: ${r.padrao}`}
                  onClick={() => {
                    setEmEdicao(r)
                    setAberto(true)
                  }}
                >
                  <PencilIcon />
                  {tc('editar')}
                </Button>
                <Button size="sm" variant="ghost" aria-label={`${tc('excluir')}: ${r.padrao}`} onClick={() => setParaExcluir(r)}>
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
          <FormRegra key={emEdicao?.id ?? 'nova'} workspaceId={workspaceId} regra={emEdicao} categorias={categorias} aoMudar={setAberto} />
        </DialogContent>
      </Dialog>

      <ConfirmarDialogo
        aberto={paraExcluir !== null}
        aoMudar={(v) => {
          if (!v) setParaExcluir(null)
        }}
        titulo={t('excluirTitulo')}
        texto={t('excluirTexto', { padrao: paraExcluir?.padrao ?? '' })}
        rotuloConfirmar={tc('excluir')}
        aoConfirmar={async () => {
          if (!paraExcluir) return null
          const r = await excluirRegra(workspaceId, paraExcluir.id)
          return r.ok ? null : r.erro
        }}
      />
    </section>
  )
}

function FormRegra({
  workspaceId,
  regra,
  categorias,
  aoMudar,
}: {
  workspaceId: string
  regra?: RegraDb
  categorias: Categoria[]
  aoMudar: (v: boolean) => void
}) {
  const t = useTranslations('config.regras')
  const tc = useTranslations('comum')
  const [padrao, setPadrao] = useState(regra?.padrao ?? '')
  const [categoriaId, setCategoriaId] = useState<string | null>(regra?.categoriaId ?? null)
  const [prioridade, setPrioridade] = useState(regra ? String(regra.prioridade) : '0')
  const [erro, setErro] = useState<string | null>(null)
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [pendente, iniciar] = useTransition()
  const itens = categorias.map((c) => ({ value: c.id, label: c.nome }))

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setErro(null)
        setCampos({})
        iniciar(async () => {
          const entrada = { padrao, categoriaId: categoriaId ?? '', prioridade }
          const r = regra ? await editarRegra(workspaceId, regra.id, entrada) : await criarRegra(workspaceId, entrada)
          if (r.ok) aoMudar(false)
          else {
            setErro(r.erro)
            setCampos(r.campos ?? {})
          }
        })
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="regra-padrao">{t('padrao')}</Label>
        <Input
          id="regra-padrao"
          value={padrao}
          onChange={(e) => setPadrao(e.target.value)}
          placeholder={t('padraoPlaceholder')}
          autoComplete="off"
          autoFocus
          aria-invalid={!!campos.padrao}
        />
        {campos.padrao && <p className="text-sm text-destructive">{campos.padrao}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t('categoria')}</Label>
        <Select value={categoriaId} items={itens} onValueChange={(v) => setCategoriaId(v)}>
          <SelectTrigger className="w-full" aria-label={t('categoria')} aria-invalid={!!campos.categoriaId}>
            <SelectValue placeholder={t('categoria')} />
          </SelectTrigger>
          <SelectContent>
            {itens.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {campos.categoriaId && <p className="text-sm text-destructive">{campos.categoriaId}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="regra-prioridade">{t('prioridade')}</Label>
        <Input
          id="regra-prioridade"
          inputMode="numeric"
          value={prioridade}
          onChange={(e) => setPrioridade(e.target.value)}
          autoComplete="off"
          aria-invalid={!!campos.prioridade}
        />
        <p className="text-xs text-muted-foreground">{t('prioridadeDica')}</p>
        {campos.prioridade && <p className="text-sm text-destructive">{campos.prioridade}</p>}
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
