'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { hojeLocal } from '@/lib/formato'
import { useLancamentoRapido } from '@/features/lancamentos/lancamento-rapido-contexto'
import type { Regra } from '@/features/importacao/aplicar-regras'
import { calarFala, falar } from './falar'
import { resolverPeriodo } from '@/features/exportacao/periodos'
import type { TipoExportacao } from '@/features/exportacao/relatorio'
import { interpretarComando } from './interpretar-comando'
import { interpretarFala, type FalaInterpretada } from './interpretar-fala'
import { useReconhecimento } from './use-reconhecimento'
import { ConfirmacaoExportacao, type ComandoExportar } from './confirmacao-exportacao'
import { ConfirmacaoVoz } from './confirmacao-voz'
import { TelaDigitar, TelaErro, TelaOuvindo, TelaPeriodo } from './telas-voz'

type FalaOk = Extract<FalaInterpretada, { ok: true }>

type Fase =
  | { tipo: 'fechado' }
  | { tipo: 'ouvindo' }
  | { tipo: 'digitando' }
  | { tipo: 'confirmando'; fala: FalaOk; texto: string }
  | { tipo: 'exportando'; cmd: ComandoExportar; texto: string }
  | { tipo: 'periodo'; favorecido: string; texto: string }
  | { tipo: 'erro'; mensagem: string; texto: string | null; falarMensagem: boolean }

/** Pedido de lista que ficou sem período: o que já foi entendido espera a resposta. */
type Retido = { favorecido: string; filtroTipo: TipoExportacao }

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
  const [retido, setRetido] = useState<Retido | null>(null)

  // Toda frase passa por `interpretarComando`: pedido de lista segue o fluxo de exportação; qualquer
  // outra coisa é lançamento (fluxo anterior, intacto).
  const processar = useCallback(
    (texto: string) => {
      const hoje = hojeLocal()
      const cmd = interpretarComando(texto, hoje)
      if (cmd.tipo === 'exportar') {
        setRetido(null)
        setFase({ tipo: 'exportando', cmd, texto })
        return
      }
      if (cmd.tipo === 'exportar_incompleto') {
        setRetido({ favorecido: cmd.favorecido, filtroTipo: cmd.filtroTipo })
        setFase({ tipo: 'periodo', favorecido: cmd.favorecido, texto })
        return
      }
      // Resposta à pergunta "de que período?": completa o pedido que ficou esperando.
      if (retido) {
        const periodo = resolverPeriodo(texto, hoje)
        if (periodo) {
          setRetido(null)
          setFase({
            tipo: 'exportando',
            cmd: { tipo: 'exportar', favorecido: retido.favorecido, ...periodo, filtroTipo: retido.filtroTipo },
            texto,
          })
          return
        }
        // Nem período nem lançamento: continua perguntando o período.
        if (!interpretarFala(texto, hoje).ok) {
          setFase({ tipo: 'periodo', favorecido: retido.favorecido, texto })
          return
        }
        setRetido(null)
      }
      const r = interpretarFala(texto, hoje)
      if (r.ok) setFase({ tipo: 'confirmando', fala: r, texto })
      else if (r.motivo === 'sem_valor') {
        setFase({ tipo: 'erro', mensagem: t('naoEntendiValor'), texto, falarMensagem: true })
      } else setFase({ tipo: 'erro', mensagem: t('naoEntendiVazio'), texto: null, falarMensagem: false })
    },
    [t, retido],
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
    setRetido(null)
    setFase({ tipo: 'fechado' })
  }, [rec])

  // O lançamento rápido (atalho "Falar") dispara o mesmo fluxo.
  useEffect(() => {
    registrarVoz(iniciar)
    return () => registrarVoz(null)
  }, [registrarVoz, iniciar])

  // Pergunta falada do período.
  useEffect(() => {
    if (fase.tipo === 'periodo') {
      falar(fase.favorecido ? t('exportar.perguntaPeriodoPara', { nome: fase.favorecido }) : t('exportar.perguntaPeriodo'))
    }
  }, [fase, t])

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
          {fase.tipo === 'periodo' && (
            <TelaPeriodo
              favorecido={fase.favorecido}
              texto={fase.texto}
              podeFalar={rec.suportado}
              aoEscolher={processar}
              aoFalar={iniciar}
              aoDigitar={digitar}
              aoCancelar={fechar}
            />
          )}
          {fase.tipo === 'exportando' && (
            <ConfirmacaoExportacao
              key={`${fase.texto}|${fase.cmd.favorecido}|${fase.cmd.de}|${fase.cmd.ate}`}
              cmd={fase.cmd}
              texto={fase.texto}
              aoFalarDeNovo={iniciar}
              aoFechar={fechar}
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
