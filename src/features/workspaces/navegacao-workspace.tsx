'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const ITENS = [
  { chave: 'dashboard', rota: '' },
  { chave: 'lancamentos', rota: '/lancamentos' },
  { chave: 'importar', rota: '/importar' },
  { chave: 'orcamento', rota: '/orcamento' },
  { chave: 'config', rota: '/config' },
] as const

export function NavegacaoWorkspace({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const base = `/w/${workspaceId}`

  return (
    <nav aria-label={t('principal')} className="-mb-px flex gap-1 overflow-x-auto">
      {ITENS.map((i) => {
        const href = base + i.rota
        const ativo = i.rota === '' ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={i.chave}
            href={href}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              ativo
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(i.chave)}
          </Link>
        )
      })}
    </nav>
  )
}
