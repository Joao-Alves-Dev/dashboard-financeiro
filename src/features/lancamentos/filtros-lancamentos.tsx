'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FiltrosLancamentos } from './schemas'
import type { OpcaoCategoria, OpcaoConta } from './form-lancamento'

const TODAS = '__todas'

/** Filtros viram searchParams (a página é Server Component e relê a URL). Mudar filtro volta à página 1. */
export function FiltrosLancamentosForm({
  filtros,
  contas,
  categorias,
}: {
  filtros: FiltrosLancamentos
  contas: OpcaoConta[]
  categorias: OpcaoCategoria[]
}) {
  const t = useTranslations('lancamentos.filtros')
  const tc = useTranslations('comum')
  const router = useRouter()
  const pathname = usePathname()
  const [de, setDe] = useState(filtros.de ?? '')
  const [ate, setAte] = useState(filtros.ate ?? '')
  const [contaId, setContaId] = useState(filtros.contaId ?? TODAS)
  const [categoriaId, setCategoriaId] = useState(filtros.categoriaId ?? TODAS)
  const [texto, setTexto] = useState(filtros.texto ?? '')

  const itensConta = [{ value: TODAS, label: tc('todas') }, ...contas.map((c) => ({ value: c.id, label: c.nome }))]
  const itensCategoria = [
    { value: TODAS, label: tc('todas') },
    ...categorias.map((c) => ({ value: c.id, label: c.nome })),
  ]

  function aplicar(e: React.FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (de) p.set('de', de)
    if (ate) p.set('ate', ate)
    if (contaId !== TODAS) p.set('contaId', contaId)
    if (categoriaId !== TODAS) p.set('categoriaId', categoriaId)
    if (texto.trim()) p.set('texto', texto.trim())
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function limpar() {
    setDe('')
    setAte('')
    setContaId(TODAS)
    setCategoriaId(TODAS)
    setTexto('')
    router.push(pathname)
  }

  return (
    <form
      onSubmit={aplicar}
      aria-label={t('titulo')}
      className="grid grid-cols-2 gap-3 rounded-lg border p-3 md:grid-cols-6"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-de">{t('de')}</Label>
        <Input id="f-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-ate">{t('ate')}</Label>
        <Input id="f-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>{t('conta')}</Label>
        <Select value={contaId} items={itensConta} onValueChange={(v) => setContaId(v ?? TODAS)}>
          <SelectTrigger className="w-full" aria-label={t('conta')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {itensConta.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label>{t('categoria')}</Label>
        <Select value={categoriaId} items={itensCategoria} onValueChange={(v) => setCategoriaId(v ?? TODAS)}>
          <SelectTrigger className="w-full" aria-label={t('categoria')}>
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
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor="f-texto">{t('texto')}</Label>
        <Input
          id="f-texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={t('textoPlaceholder')}
          autoComplete="off"
        />
      </div>
      <div className="col-span-2 flex gap-2 md:col-span-6 md:justify-end">
        <Button type="submit">{t('aplicar')}</Button>
        <Button type="button" variant="outline" onClick={limpar}>
          {t('limpar')}
        </Button>
      </div>
    </form>
  )
}
