'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MenuIcon } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const ITENS = [
  { chave: 'importar', rota: '/importar' },
  { chave: 'orcamento', rota: '/orcamento' },
  { chave: 'config', rota: '/config' },
] as const

/** Só no celular: páginas que não cabem na barra inferior (a navegação do topo some < 768px). */
export function MenuMais({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const base = `/w/${workspaceId}`
  const ativo = ITENS.some((i) => pathname.startsWith(base + i.rota))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('maisTitulo')}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden',
          ativo && 'bg-muted',
        )}
      >
        <MenuIcon className="size-5" aria-hidden />
        {t('mais')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {ITENS.map((i) => {
          const href = base + i.rota
          const atual = pathname.startsWith(href)
          return (
            <DropdownMenuItem
              key={i.chave}
              render={<Link href={href} aria-current={atual ? 'page' : undefined} />}
              className={cn('min-h-11 px-3 text-base', atual && 'font-semibold')}
            >
              {t(i.chave)}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
