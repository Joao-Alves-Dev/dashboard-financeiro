'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

// Interfaces mínimas da Web Speech API (o lib.dom do TypeScript não as traz de forma estável).
interface AlternativaFala {
  readonly transcript: string
}
interface ResultadoFala {
  readonly isFinal: boolean
  readonly length: number
  readonly [indice: number]: AlternativaFala
}
interface EventoResultado {
  readonly resultIndex: number
  readonly results: { readonly length: number; readonly [indice: number]: ResultadoFala }
}
interface EventoErro {
  readonly error: string
}
interface Reconhecedor {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((e: EventoResultado) => void) | null
  onerror: ((e: EventoErro) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type ConstrutorReconhecedor = new () => Reconhecedor

function construtor(): ConstrutorReconhecedor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecedor
    webkitSpeechRecognition?: ConstrutorReconhecedor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const semAssinatura = () => () => {}

/** Escuta máxima por toque; passou disso, o reconhecimento é encerrado e o usuário é avisado. */
export const TEMPO_MAXIMO_MS = 15000

export type Reconhecimento = {
  suportado: boolean
  /** `true` depois que o cliente checou o suporte (evita piscar "sem suporte" na hidratação). */
  verificado: boolean
  ouvindo: boolean
  /** Transcrição parcial, atualizada enquanto a pessoa fala. */
  parcial: string
  iniciar(): void
  parar(): void
  /** Texto final da última escuta (`null` enquanto não houve). */
  final: string | null
  erro: string | null
  /** A escuta foi cortada pelo tempo máximo. */
  esgotou: boolean
}

export function useReconhecimento(): Reconhecimento {
  const t = useTranslations('voz.erros')
  // Só o cliente sabe se há API: o servidor e a hidratação veem `false`, depois o valor real.
  const suportado = useSyncExternalStore(
    semAssinatura,
    () => construtor() !== null,
    () => false,
  )
  const verificado = useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  )
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [final, setFinal] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [esgotou, setEsgotou] = useState(false)
  const rec = useRef<Reconhecedor | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textoRef = useRef('')
  const entregueRef = useRef(false)
  const esgotouRef = useRef(false)
  const erroRef = useRef(false)

  const limparTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const iniciar = useCallback(() => {
    const Ctor = construtor()
    if (!Ctor) return
    const anterior = rec.current
    if (anterior) {
      anterior.onend = anterior.onresult = anterior.onerror = anterior.onstart = null
      anterior.abort()
    }
    limparTimer()
    textoRef.current = ''
    entregueRef.current = false
    esgotouRef.current = false
    erroRef.current = false
    setParcial('')
    setFinal(null)
    setErro(null)
    setEsgotou(false)

    const r = new Ctor()
    r.lang = 'pt-BR'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    r.onstart = () => setOuvindo(true)
    r.onresult = (e) => {
      let texto = ''
      let terminou = false
      for (let i = 0; i < e.results.length; i++) {
        texto += e.results[i][0].transcript
        if (e.results[i].isFinal) terminou = true
      }
      texto = texto.trim()
      textoRef.current = texto
      setParcial(texto)
      if (terminou && !entregueRef.current && texto) {
        entregueRef.current = true
        setFinal(texto)
      }
    }
    r.onerror = (e) => {
      if (e.error === 'aborted') return
      erroRef.current = true
      const chave: Record<string, string> = {
        'not-allowed': 'microfoneNegado',
        'service-not-allowed': 'microfoneNegado',
        'no-speech': 'semFala',
        network: 'semRede',
        'audio-capture': 'semMicrofone',
      }
      setErro(t(chave[e.error] ?? 'generico'))
    }
    r.onend = () => {
      limparTimer()
      setOuvindo(false)
      if (rec.current === r) rec.current = null
      // O Chrome às vezes encerra sem marcar o resultado como final: usa o que foi ouvido.
      if (!entregueRef.current && textoRef.current) {
        entregueRef.current = true
        setFinal(textoRef.current)
      } else if (!entregueRef.current && !erroRef.current) {
        setErro(t(esgotouRef.current ? 'tempoEsgotado' : 'semFala'))
      }
    }
    rec.current = r
    timer.current = setTimeout(() => {
      esgotouRef.current = true
      setEsgotou(true)
      r.stop()
    }, TEMPO_MAXIMO_MS)
    try {
      r.start()
    } catch {
      // start() lança se já houver uma escuta em andamento.
      limparTimer()
      setErro(t('generico'))
    }
  }, [t])

  const parar = useCallback(() => {
    rec.current?.stop()
  }, [])

  useEffect(
    () => () => {
      limparTimer()
      const r = rec.current
      if (r) {
        r.onend = r.onresult = r.onerror = r.onstart = null
        r.abort()
      }
    },
    [],
  )

  return { suportado, verificado, ouvindo, parcial, iniciar, parar, final, erro, esgotou }
}
