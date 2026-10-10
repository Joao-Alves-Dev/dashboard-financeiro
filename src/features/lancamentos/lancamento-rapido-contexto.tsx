'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ZapIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LancamentoRapido, type ValoresIniciaisRapido } from './lancamento-rapido'
import type { OpcaoCategoria, OpcaoConta } from './form-lancamento'

/** Dados do workspace que a voz reaproveita (já carregados no layout; nada novo é buscado). */
export type DadosRapido = {
  workspaceId: string
  contas: OpcaoConta[]
  categorias: OpcaoCategoria[]
  favorecidos: string[]
  contaPadraoId: string | null
}

type Contexto = {
  abrir: (iniciais?: ValoresIniciaisRapido) => void
  /** Mostra a confirmação (`role=status`) usada após salvar, pelo rápido e pela voz. */
  avisar: (mensagem: string) => void
  /** Inicia o fluxo de voz (registrado pelo `VozProvider`); sem voz registrada, não faz nada. */
  iniciarVoz: () => void
  registrarVoz: (iniciar: (() => void) | null) => void
  dados: DadosRapido
}

const Ctx = createContext<Contexto | null>(null)

/** Abre o lançamento rápido (barra inferior, botão do desktop e a voz, com valores pré-preenchidos). */
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
  /** Nomes de favorecidos já usados (autocomplete do campo opcional). */
  favorecidos: string[]
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

  const vozRef = useRef<(() => void) | null>(null)
  const registrarVoz = useCallback((f: (() => void) | null) => {
    vozRef.current = f
  }, [])
  const iniciarVoz = useCallback(() => vozRef.current?.(), [])

  const { workspaceId, contas, categorias, favorecidos, contaPadraoId } = dados
  const valor = useMemo(
    () => ({
      abrir,
      avisar: mostrarAviso,
      iniciarVoz,
      registrarVoz,
      dados: { workspaceId, contas, categorias, favorecidos, contaPadraoId },
    }),
    [abrir, mostrarAviso, iniciarVoz, registrarVoz, workspaceId, contas, categorias, favorecidos, contaPadraoId],
  )

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
        aoFalar={iniciarVoz}
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
