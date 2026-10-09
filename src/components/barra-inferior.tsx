'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { HouseIcon, LightbulbIcon, PlusIcon, ReceiptIcon, TargetIcon, type LucideIcon } from 'lucide-react'
import { useLancamentoRapido } from '@/features/lancamentos/lancamento-rapido-contexto'
import { cn } from '@/lib/utils'

type Item = { chave: 'inicio' | 'lancamentos' | 'metas' | 'orientacoes'; rota: string; Icone: LucideIcon }

const ESQUERDA: Item[] = [
  { chave: 'inicio', rota: '', Icone: HouseIcon },
  { chave: 'lancamentos', rota: '/lancamentos', Icone: ReceiptIcon },
]
const DIREITA: Item[] = [
  { chave: 'metas', rota: '/metas', Icone: TargetIcon },
  { chave: 'orientacoes', rota: '/orientacoes', Icone: LightbulbIcon },
]

/**
 * Barra inferior do celular (< 768px). O + central é o único elemento de cor da barra:
 * lançar um gasto é a ação mais frequente do app. Importar, Orçamento e Configurações
 * ficam no menu "Mais" do cabeçalho (mesma navegação, sem lotar a barra).
 */
export function BarraInferior({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { abrir } = useLancamentoRapido()
  const base = `/w/${workspaceId}`

  function link({ chave, rota, Icone }: Item) {
    const href = base + rota
    const ativo = rota === '' ? pathname === base : pathname.startsWith(href)
    return (
      <Link
        key={chave}
        href={href}
        aria-current={ativo ? 'page' : undefined}
        className={cn(
          'relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/60',
          ativo ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span
          aria-hidden
          className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-marca transition-opacity', ativo ? 'opacity-100' : 'opacity-0')}
        />
        <Icone className="size-5" aria-hidden strokeWidth={ativo ? 2.5 : 2} />
        {t(chave)}
      </Link>
    )
  }

  return (
    <nav
      aria-label={t('barra')}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1">
        {ESQUERDA.map(link)}
        <button
          type="button"
          onClick={() => abrir()}
          className="group flex min-h-14 flex-col items-center justify-end gap-0.5 pb-2 text-xs font-medium text-foreground outline-none"
        >
          <span className="-mt-5 flex size-14 items-center justify-center rounded-full bg-marca text-marca-foreground shadow-lg ring-4 ring-background transition-transform group-focus-visible:ring-ring group-active:scale-95">
            <PlusIcon className="size-7" aria-hidden strokeWidth={2.75} />
          </span>
          {t('lancar')}
        </button>
        {DIREITA.map(link)}
      </div>
    </nav>
  )
}
