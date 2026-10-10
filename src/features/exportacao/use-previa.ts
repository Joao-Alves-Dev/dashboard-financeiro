'use client'

import { useEffect, useRef, useState } from 'react'
import type { Relatorio } from './relatorio'
import { renderizarPng } from './render-png'

type Previa = { chave: string; blobs: Blob[]; urls: string[]; erro: boolean }

export type EstadoPrevia = {
  /** Imagens PNG exatamente como serão enviadas (uma por parte). */
  blobs: Blob[]
  urls: string[]
  /** Ainda desenhando a versão atual do relatório. */
  gerando: boolean
  erro: boolean
}

const VAZIO: Blob[] = []
const SEM_URLS: string[] = []

/**
 * Gera as imagens PNG do relatório no navegador e devolve URLs para um `<img>`. Sem relatório, ou
 * sem linhas, não gera nada. As URLs antigas são liberadas quando as novas ficam prontas e ao sair.
 */
export function usePrevia(relatorio: Relatorio | null): EstadoPrevia {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const urlsAtuais = useRef<string[]>([])
  const ativo = relatorio !== null && relatorio.linhas.length > 0
  const chave = ativo ? JSON.stringify(relatorio) : ''

  useEffect(() => {
    if (!relatorio || relatorio.linhas.length === 0) return
    let cancelado = false
    renderizarPng(relatorio).then(
      (blobs) => {
        if (cancelado) return
        const antigas = urlsAtuais.current
        const urls = blobs.map((b) => URL.createObjectURL(b))
        urlsAtuais.current = urls
        setPrevia({ chave, blobs, urls, erro: false })
        setTimeout(() => antigas.forEach((u) => URL.revokeObjectURL(u)), 1000)
      },
      () => {
        if (!cancelado) setPrevia({ chave, blobs: VAZIO, urls: SEM_URLS, erro: true })
      },
    )
    return () => {
      cancelado = true
    }
    // `chave` representa o conteúdo de `relatorio`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  useEffect(
    () => () => {
      urlsAtuais.current.forEach((u) => URL.revokeObjectURL(u))
      urlsAtuais.current = []
    },
    [],
  )

  if (!ativo) return { blobs: VAZIO, urls: SEM_URLS, gerando: false, erro: false }
  const atual = previa?.chave === chave
  // Enquanto a nova versão é desenhada, a prévia anterior continua visível (sem piscar), mas só as
  // imagens atuais ficam disponíveis para enviar.
  return {
    blobs: atual ? previa.blobs : VAZIO,
    urls: previa?.urls ?? SEM_URLS,
    gerando: !atual,
    erro: atual ? previa.erro : false,
  }
}
