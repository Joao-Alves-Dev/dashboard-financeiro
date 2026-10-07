'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlusIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Item = { id: string; nome: string; tipo: string }

export function SeletorWorkspace({ atualId, workspaces }: { atualId: string; workspaces: Item[] }) {
  const t = useTranslations('workspace')
  const router = useRouter()
  const atual = workspaces.find((w) => w.id === atualId)
  const itens = workspaces.map((w) => ({ value: w.id, label: w.nome }))

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={atualId}
        items={itens}
        onValueChange={(id) => {
          if (id && id !== atualId) router.push(`/w/${id}`)
        }}
      >
        <SelectTrigger className="min-w-0 max-w-[12rem]" aria-label={t('seletor')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.nome}
              <Badge variant="secondary" className="ml-2">
                {t(`tipo.${w.tipo === 'empresa' ? 'empresa' : 'pessoal'}`)}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {atual && (
        <Badge variant={atual.tipo === 'empresa' ? 'default' : 'secondary'}>
          {t(`tipo.${atual.tipo === 'empresa' ? 'empresa' : 'pessoal'}`)}
        </Badge>
      )}
      <Link
        href="/novo"
        aria-label={t('novo')}
        title={t('novo')}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border hover:bg-muted"
      >
        <PlusIcon className="size-4" />
      </Link>
    </div>
  )
}
