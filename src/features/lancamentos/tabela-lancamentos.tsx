'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmarDialogo } from '@/components/confirmar-dialogo'
import { classeValor } from '@/lib/cores'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { categorizarEmLote, excluirLancamento } from './actions'
import { FormLancamento, type OpcaoCategoria, type OpcaoConta } from './form-lancamento'
import type { Lancamento } from './servico'

type Props = {
  workspaceId: string
  tipoWorkspace: string
  itens: Lancamento[]
  total: number
  contas: OpcaoConta[]
  categorias: OpcaoCategoria[]
  favorecidos: string[]
  temFiltro: boolean
}

export function TabelaLancamentos({ workspaceId, tipoWorkspace, itens, total, contas, categorias, favorecidos, temFiltro }: Props) {
  const t = useTranslations('lancamentos')
  const tc = useTranslations('comum')
  const [formAberto, setFormAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<Lancamento | undefined>()
  const [paraExcluir, setParaExcluir] = useState<Lancamento | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loteAberto, setLoteAberto] = useState(false)

  const nomeConta = useMemo(() => new Map(contas.map((c) => [c.id, c.nome])), [contas])
  const nomeCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])
  const idsPagina = itens.map((i) => i.id)
  const todos = idsPagina.length > 0 && idsPagina.every((id) => selecionados.has(id))
  const algum = selecionados.size > 0

  function alternar(id: string, marcado: boolean) {
    setSelecionados((prev) => {
      const novo = new Set(prev)
      if (marcado) novo.add(id)
      else novo.delete(id)
      return novo
    })
  }

  function alternarTodos(marcado: boolean) {
    setSelecionados(marcado ? new Set(idsPagina) : new Set())
  }

  function abrirNovo() {
    setEmEdicao(undefined)
    setFormAberto(true)
  }

  function abrirEdicao(l: Lancamento) {
    setEmEdicao(l)
    setFormAberto(true)
  }

  const semConta = contas.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t('total', { total })}
        </p>
        {semConta ? (
          <Link
            href={`/w/${workspaceId}/config?aba=contas`}
            className={buttonVariants()}
          >
            <PlusIcon className="size-4" />
            {t('criarConta')}
          </Link>
        ) : (
          <Button onClick={abrirNovo}>
            <PlusIcon />
            {t('novo')}
          </Button>
        )}
      </div>

      {algum && (
        <div
          role="region"
          aria-label={t('categorizar')}
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border bg-muted px-3 py-2"
        >
          <span className="text-sm font-medium">{t('selecionados', { n: selecionados.size })}</span>
          <Button size="sm" onClick={() => setLoteAberto(true)}>
            {t('categorizar')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>
            {t('limparSelecao')}
          </Button>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          {semConta ? (
            <>
              <p className="font-medium">{t('semConta')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('semContaDescricao')}</p>
            </>
          ) : (
            <>
              <p className="font-medium">{t('vazio')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {temFiltro ? t('vazioFiltro') : t('vazioDescricao')}
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Tabela (md+) */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todos}
                      onCheckedChange={(v) => alternarTodos(v === true)}
                      aria-label={t('selecionarTodos')}
                    />
                  </TableHead>
                  <TableHead>{t('colunas.data')}</TableHead>
                  <TableHead>{t('colunas.descricao')}</TableHead>
                  <TableHead>{t('colunas.favorecido')}</TableHead>
                  <TableHead>{t('colunas.conta')}</TableHead>
                  <TableHead>{t('colunas.categoria')}</TableHead>
                  <TableHead className="text-right">{t('colunas.valor')}</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">{tc('acoes')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((l) => (
                  <TableRow key={l.id} data-state={selecionados.has(l.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selecionados.has(l.id)}
                        onCheckedChange={(v) => alternar(l.id, v === true)}
                        aria-label={`${t('selecionar')}: ${l.descricao}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatarDataBR(l.data)}</TableCell>
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2">{l.descricao}</span>
                      {l.status === 'pendente' && (
                        <Badge variant="outline" className="ml-2">
                          {t('status.pendente')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-48">
                      {l.favorecido ? <span className="line-clamp-2">{l.favorecido}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{nomeConta.get(l.contaId) ?? '—'}</TableCell>
                    <TableCell>{l.categoriaId ? (nomeCategoria.get(l.categoriaId) ?? '—') : <span className="text-muted-foreground">{t('semCategoria')}</span>}</TableCell>
                    <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${classeValor(l.valorCentavos)}`}>
                      {formatarBRL(l.valorCentavos)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={`${tc('editar')}: ${l.descricao}`} onClick={() => abrirEdicao(l)}>
                          <PencilIcon />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={`${tc('excluir')}: ${l.descricao}`} onClick={() => setParaExcluir(l)}>
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Lista de cartões (< md) */}
          <ul className="flex flex-col gap-2 md:hidden">
            {itens.map((l) => (
              <li
                key={l.id}
                className={`rounded-lg border p-3 ${selecionados.has(l.id) ? 'bg-muted' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selecionados.has(l.id)}
                    onCheckedChange={(v) => alternar(l.id, v === true)}
                    aria-label={`${t('selecionar')}: ${l.descricao}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{l.descricao}</p>
                    {l.favorecido && (
                      <p className="mt-0.5 break-words text-sm text-muted-foreground">
                        {t('favorecidoLinha', { tipo: l.valorCentavos > 0 ? 'entrada' : 'saida', nome: l.favorecido })}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatarDataBR(l.data)} · {nomeConta.get(l.contaId) ?? '—'} ·{' '}
                      {l.categoriaId ? (nomeCategoria.get(l.categoriaId) ?? '—') : t('semCategoria')}
                    </p>
                    {l.status === 'pendente' && (
                      <Badge variant="outline" className="mt-1">
                        {t('status.pendente')}
                      </Badge>
                    )}
                  </div>
                  <p className={`whitespace-nowrap text-right font-semibold tabular-nums ${classeValor(l.valorCentavos)}`}>
                    {formatarBRL(l.valorCentavos)}
                  </p>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => abrirEdicao(l)}>
                    <PencilIcon />
                    {tc('editar')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setParaExcluir(l)}>
                    <Trash2Icon />
                    {tc('excluir')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <FormLancamento
        workspaceId={workspaceId}
        tipoWorkspace={tipoWorkspace}
        contas={contas}
        categorias={categorias}
        favorecidos={favorecidos}
        lancamento={emEdicao}
        aberto={formAberto}
        aoMudar={setFormAberto}
      />

      <ConfirmarDialogo
        aberto={paraExcluir !== null}
        aoMudar={(v) => {
          if (!v) setParaExcluir(null)
        }}
        titulo={t('excluirTitulo')}
        texto={t('excluirTexto', { descricao: paraExcluir?.descricao ?? '' })}
        rotuloConfirmar={tc('excluir')}
        aoConfirmar={async () => {
          if (!paraExcluir) return null
          const r = await excluirLancamento(workspaceId, paraExcluir.id)
          if (r.ok) {
            setSelecionados((prev) => {
              const novo = new Set(prev)
              novo.delete(paraExcluir.id)
              return novo
            })
            return null
          }
          return r.erro
        }}
      />

      <LoteDialogo
        aberto={loteAberto}
        aoMudar={setLoteAberto}
        workspaceId={workspaceId}
        ids={[...selecionados]}
        categorias={categorias}
        aoConcluir={() => setSelecionados(new Set())}
      />
    </div>
  )
}

const SEM_CATEGORIA = '__nenhuma'

function LoteDialogo({
  aberto,
  aoMudar,
  workspaceId,
  ids,
  categorias,
  aoConcluir,
}: {
  aberto: boolean
  aoMudar: (v: boolean) => void
  workspaceId: string
  ids: string[]
  categorias: OpcaoCategoria[]
  aoConcluir: () => void
}) {
  const t = useTranslations('lancamentos')
  const tc = useTranslations('comum')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const itens = [{ value: SEM_CATEGORIA, label: t('semCategoria') }, ...categorias.map((c) => ({ value: c.id, label: c.nome }))]

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) setErro(null)
        aoMudar(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('categorizarTitulo')}</DialogTitle>
          <DialogDescription>
            {t('categorizarDescricao')} ({t('selecionados', { n: ids.length })})
          </DialogDescription>
        </DialogHeader>
        <Select value={categoriaId} items={itens} onValueChange={(v) => setCategoriaId(v)}>
          <SelectTrigger className="w-full" aria-label={t('campos.categoria')}>
            <SelectValue placeholder={t('campos.categoria')} />
          </SelectTrigger>
          <SelectContent>
            {itens.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => aoMudar(false)}>
            {tc('cancelar')}
          </Button>
          <Button
            disabled={pendente || ids.length === 0 || categoriaId === null}
            onClick={() =>
              iniciar(async () => {
                if (categoriaId === null) return
                const r = await categorizarEmLote(workspaceId, ids, categoriaId === SEM_CATEGORIA ? null : categoriaId)
                if (r.ok) {
                  aoConcluir()
                  aoMudar(false)
                } else {
                  setErro(r.erro)
                }
              })
            }
          >
            {pendente ? tc('salvando') : t('aplicarCategoria')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
