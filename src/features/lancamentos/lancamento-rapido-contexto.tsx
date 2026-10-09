'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ZapIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LancamentoRapido, type ValoresIniciaisRapido } from './lancamento-rapido'
import type { OpcaoCategoria, OpcaoConta } from './form-lancamento'

type Contexto = { abrir: (iniciais?: ValoresIniciaisRapido) => void }

const Ctx = createContext<Contexto | null>(null)

/** Abre o lançamento rápido (barra inferior, botão do desktop e, na Task 15, a voz com valores pré-preenchidos). */
export function useLancamentoRapido(): Contexto {
  const c = useContext(Ctx)
  if (!c) throw new Error('useLancamentoRapido fora do LancamentoRapidoProvider')
  return c
}

type Props = {
  workspaceId: string
  contas: OpcaoConta[]
  categorias: OpcaoCategoria[]
  frequentes: OpcaoCategoria[]
  contaPadraoId: string | null
  children: React.ReactNode
}

export function LancamentoRapidoProvider({ children, ...dados }: Props) {
  const [aberto, setAberto] = useState(false)
  const [iniciais, setIniciais] = useState<ValoresIniciaisRapido>({})
  const [aberturas, setAberturas] = useState(0)
  const [aviso, setAviso] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const abrir = useCallback((v?: ValoresIniciaisRapido) => {
    setIniciais(v ?? {})
    setAberturas((n) => n + 1)
    setAberto(true)
  }, [])

  const mostrarAviso = useCallback((msg: string) => {
    setAviso(msg)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setAviso(''), 5000)
  }, [])
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const valor = useMemo(() => ({ abrir }), [abrir])

  return (
    <Ctx.Provider value={valor}>
      {children}
      <LancamentoRapido
        key={aberturas}
        {...dados}
        {...iniciais}
        aberto={aberto}
        aoMudar={setAberto}
        aoSalvar={mostrarAviso}
      />
      {/* Região sempre presente para leitores de tela anunciarem a confirmação; visível acima da barra inferior. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6"
      >
        {aviso && (
          <p className="rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">{aviso}</p>
        )}
      </div>
    </Ctx.Provider>
  )
}

/** Botão discreto do cabeçalho (só desktop; no celular o + da barra inferior faz o mesmo). */
export function BotaoLancamentoRapido() {
  const t = useTranslations('rapido')
  const { abrir } = useLancamentoRapido()
  return (
    <Button type="button" variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => abrir()}>
      <ZapIcon aria-hidden />
      {t('abrir')}
    </Button>
  )
}
