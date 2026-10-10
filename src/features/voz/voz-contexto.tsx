'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { hojeLocal } from '@/lib/formato'
import { useLancamentoRapido } from '@/features/lancamentos/lancamento-rapido-contexto'
import type { Regra } from '@/features/importacao/aplicar-regras'
import { calarFala, falar } from './falar'
import { interpretarFala, type FalaInterpretada } from './interpretar-fala'
import { useReconhecimento } from './use-reconhecimento'
import { ConfirmacaoVoz } from './confirmacao-voz'
import { TelaDigitar, TelaErro, TelaOuvindo } from './telas-voz'

type FalaOk = Extract<FalaInterpretada, { ok: true }>

type Fase =
  | { tipo: 'fechado' }
  | { tipo: 'ouvindo' }
  | { tipo: 'digitando' }
  | { tipo: 'confirmando'; fala: FalaOk; texto: string }
  | { tipo: 'erro'; mensagem: string; texto: string | null; falarMensagem: boolean }

type Contexto = {
  /** Toque no microfone: abre a tela de escuta (ou a de digitar, se o navegador não ouve). */
  iniciar: () => void
  /** Abre direto o campo "Digite a frase". */
  digitar: () => void
  suportado: boolean
  verificado: boolean
}

const Ctx = createContext<Contexto | null>(null)

export function useVoz(): Contexto {
  const c = useContext(Ctx)
  if (!c) throw new Error('useVoz fora do VozProvider')
  return c
}

/**
 * Fluxo de voz do workspace: escutar -> interpretar -> confirmar -> salvar. Mora no layout para o
 * atalho "Falar" do lançamento rápido funcionar em qualquer tela; a tela cheia cobre todos os estados.
 */
export function VozProvider({ regras, children }: { regras: Regra[]; children: React.ReactNode }) {
  const t = useTranslations('voz')
  const { registrarVoz } = useLancamentoRapido()
  const rec = useReconhecimento()
  const [fase, setFase] = useState<Fase>({ tipo: 'fechado' })
  const [finalVisto, setFinalVisto] = useState<string | null>(null)
  const [erroVisto, setErroVisto] = useState<string | null>(null)

  const processar = useCallback(
    (texto: string) => {
      const r = interpretarFala(texto, hojeLocal())
      if (r.ok) setFase({ tipo: 'confirmando', fala: r, texto })
      else if (r.motivo === 'sem_valor') {
        setFase({ tipo: 'erro', mensagem: t('naoEntendiValor'), texto, falarMensagem: true })
      } else setFase({ tipo: 'erro', mensagem: t('naoEntendiVazio'), texto: null, falarMensagem: false })
    },
    [t],
  )

  // Reage ao resultado do reconhecimento durante a renderização (padrão "ajustar estado conforme props").
  if (rec.final !== finalVisto) {
    setFinalVisto(rec.final)
    if (rec.final !== null && fase.tipo === 'ouvindo') processar(rec.final)
  }
  if (rec.erro !== erroVisto) {
    setErroVisto(rec.erro)
    if (rec.erro !== null && fase.tipo === 'ouvindo') {
      setFase({ tipo: 'erro', mensagem: rec.erro, texto: null, falarMensagem: false })
    }
  }

  const iniciar = useCallback(() => {
    calarFala()
    if (!rec.suportado) {
      setFase({ tipo: 'digitando' })
      return
    }
    setFase({ tipo: 'ouvindo' })
    rec.iniciar()
  }, [rec])

  const digitar = useCallback(() => {
    rec.parar()
    calarFala()
    setFase({ tipo: 'digitando' })
  }, [rec])

  const fechar = useCallback(() => {
    rec.parar()
    calarFala()
    setFase({ tipo: 'fechado' })
  }, [rec])

  // O lançamento rápido (atalho "Falar") dispara o mesmo fluxo.
  useEffect(() => {
    registrarVoz(iniciar)
    return () => registrarVoz(null)
  }, [registrarVoz, iniciar])

  // Fala o erro de valor (efeito só de áudio; nenhum estado é alterado aqui).
  useEffect(() => {
    if (fase.tipo === 'erro' && fase.falarMensagem) falar(fase.mensagem)
  }, [fase])

  const valor = useMemo(
    () => ({ iniciar, digitar, suportado: rec.suportado, verificado: rec.verificado }),
    [iniciar, digitar, rec.suportado, rec.verificado],
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      <Dialog open={fase.tipo !== 'fechado'} onOpenChange={(aberto) => !aberto && fechar()}>
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 flex h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ring-0 sm:max-w-none"
        >
          {fase.tipo === 'ouvindo' && (
            <TelaOuvindo
              ouvindo={rec.ouvindo}
              parcial={rec.parcial}
              aoParar={rec.parar}
              aoCancelar={fechar}
              aoDigitar={digitar}
            />
          )}
          {fase.tipo === 'digitando' && (
            <TelaDigitar semSuporte={rec.verificado && !rec.suportado} aoEnviar={processar} aoCancelar={fechar} />
          )}
          {fase.tipo === 'erro' && (
            <TelaErro
              mensagem={fase.mensagem}
              texto={fase.texto}
              podeFalar={rec.suportado}
              aoFalarDeNovo={iniciar}
              aoDigitar={digitar}
              aoCancelar={fechar}
            />
          )}
          {fase.tipo === 'confirmando' && (
            <ConfirmacaoVoz
              key={fase.texto}
              fala={fase.fala}
              texto={fase.texto}
              regras={regras}
              aoFalarDeNovo={iniciar}
              aoFechar={fechar}
            />
          )}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}
