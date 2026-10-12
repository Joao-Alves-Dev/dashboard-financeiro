'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { DownloadIcon, Share2Icon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { buscarLancamentosParaExportar } from '@/features/exportacao/actions'
import { baixarPng, compartilharPng, type BaseArquivo } from '@/features/exportacao/arquivos'
import { montarRelatorio } from '@/features/exportacao/relatorio'
import type { ResultadoExportacao } from '@/features/exportacao/servico'
import { sugerirFavorecidos } from '@/features/exportacao/sugerir-favorecidos'
import { usePrevia } from '@/features/exportacao/use-previa'
import { normalizarFavorecido } from '@/features/favorecido/normalizar'
import { useLancamentoRapido } from '@/features/lancamentos/lancamento-rapido-contexto'
import { hojeLocal } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { dataPorExtenso } from './datas-fala'
import { falar } from './falar'
import type { Comando } from './interpretar-comando'
import { CabecalhoVoz } from './telas-voz'
import { quantidadeFalada } from './valor-por-extenso'

export type ComandoExportar = Extract<Comando, { tipo: 'exportar' }>

type Busca = { chave: string; resultado: { ok: true; data: ResultadoExportacao } | { ok: false; erro: string } }

/** "hoje, 8 de outubro" → "8 de outubro": na fala do período o "hoje," só atrapalha. */
const dataFalada = (iso: string, hoje: string) => dataPorExtenso(iso, hoje).replace(/^(hoje|ontem|anteontem), /, '')

/**
 * Resultado do comando de exportação: a lista pronta (o mesmo PNG que será enviado), fala o resumo
 * e oferece Compartilhar / Baixar / Falar de novo / Ajustar. Zero resultados e nomes desconhecidos
 * (com sugestões) também são mostrados e falados.
 */
export function ConfirmacaoExportacao({
  cmd,
  texto,
  aoFalarDeNovo,
  aoFechar,
}: {
  cmd: ComandoExportar
  texto: string
  aoFalarDeNovo: () => void
  aoFechar: () => void
}) {
  const t = useTranslations('voz')
  const te = useTranslations('exportacao')
  const { dados } = useLancamentoRapido()
  const [favorecido, setFavorecido] = useState(cmd.favorecido)
  const [busca, setBusca] = useState<Busca | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const hoje = hojeLocal()
  const todo = cmd.todoPeriodo === true
  const chave = `${favorecido}|${cmd.de}|${cmd.ate}|${cmd.filtroTipo}|${todo}`

  useEffect(() => {
    let cancelado = false
    buscarLancamentosParaExportar(dados.workspaceId, {
      favorecido,
      de: cmd.de,
      ate: cmd.ate,
      tipo: cmd.filtroTipo,
      todoPeriodo: todo,
    }).then(
      (r) => {
        if (!cancelado) setBusca({ chave, resultado: r.ok ? r : { ok: false, erro: r.erro } })
      },
      () => {
        if (!cancelado) setBusca({ chave, resultado: { ok: false, erro: t('exportar.erro') } })
      },
    )
    return () => {
      cancelado = true
    }
  }, [dados.workspaceId, favorecido, cmd.de, cmd.ate, cmd.filtroTipo, todo, chave, t])

  const atual = busca?.chave === chave
  const resultado = atual ? busca.resultado : null
  const dadosBusca = resultado?.ok ? resultado.data : null
  const nome = dadosBusca?.nome ?? favorecido

  const relatorio = useMemo(
    () =>
      dadosBusca
        ? montarRelatorio(dadosBusca.itens, {
            favorecido: nome,
            de: cmd.de,
            ate: cmd.ate,
            tipo: cmd.filtroTipo,
            mostrarTotal: false,
            // Como no layout de referência: a coluna Anotações sai em branco (a tela de exportar liga a descrição).
            anotacoes: 'branco',
            todoPeriodo: todo,
          })
        : null,
    [dadosBusca, nome, cmd.de, cmd.ate, cmd.filtroTipo, todo],
  )
  const previa = usePrevia(relatorio)

  const quantidade = relatorio?.linhas.length ?? 0
  const inicio = relatorio?.de ?? cmd.de
  const fim = relatorio?.ate ?? cmd.ate
  const naoExiste = dadosBusca !== null && favorecido.trim() !== '' && !dadosBusca.existe
  const sugestoes = useMemo(() => {
    if (!naoExiste) return []
    const vistos = new Set<string>()
    const existentes = dados.favorecidos
      .map((n) => ({ chave: normalizarFavorecido(n), nome: n }))
      .filter((f) => f.chave !== '' && !vistos.has(f.chave) && vistos.add(f.chave))
    return sugerirFavorecidos(favorecido, existentes)
  }, [naoExiste, favorecido, dados.favorecidos])

  // O que aparece e é falado: uma só frase por situação.
  const mensagem = useMemo(() => {
    if (!atual || !resultado) return null
    if (!resultado.ok) return resultado.erro
    if (naoExiste) {
      return sugestoes.length > 0
        ? t('exportar.querDizer', { nome: favorecido, sugestoes: sugestoes.map((s) => s.nome).join(t('exportar.ou')) })
        : t('exportar.naoExiste', { nome: favorecido })
    }
    if (quantidade === 0) {
      if (todo) return nome ? t('exportar.nenhumaParaTudo', { nome }) : t('exportar.nenhumaTudo')
      return t('exportar.nenhuma')
    }
    const qtd = quantidade === 1 ? t('exportar.umaTransacao') : t('exportar.transacoes', { n: quantidadeFalada(quantidade) })
    // Sem período falado, o intervalo é o das próprias transações (menor e maior data).
    const de = dataFalada(inicio, hoje)
    const ate = dataFalada(fim, hoje)
    if (inicio === fim) {
      return nome ? t('exportar.encontrouDia', { quantidade: qtd, nome, de }) : t('exportar.encontrouTodosDia', { quantidade: qtd, de })
    }
    return nome
      ? t('exportar.encontrou', { quantidade: qtd, nome, de, ate })
      : t('exportar.encontrouTodos', { quantidade: qtd, de, ate })
  }, [atual, resultado, naoExiste, sugestoes, quantidade, favorecido, nome, todo, inicio, fim, hoje, t])

  // Efeito só de áudio (nenhum estado é alterado aqui).
  useEffect(() => {
    if (mensagem) falar(mensagem)
  }, [mensagem])

  const base: BaseArquivo = { nome: nome || 'todos', de: inicio, ate: fim }
  const pronto = quantidade > 0 && !previa.gerando && previa.blobs.length > 0
  const ajustar = (() => {
    const p = new URLSearchParams(todo ? { todo: '1' } : { de: cmd.de, ate: cmd.ate })
    if (nome) p.set('favorecido', nome)
    if (cmd.filtroTipo !== 'saidas') p.set('tipo', cmd.filtroTipo)
    return `/w/${dados.workspaceId}/exportar?${p}`
  })()

  async function executar(acao: () => Promise<string | null>) {
    setAviso(null)
    setOcupado(true)
    try {
      const msg = await acao()
      if (msg) setAviso({ texto: msg, erro: false })
    } catch {
      setAviso({ texto: t('exportar.erro'), erro: true })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <CabecalhoVoz descricao={t('exportar.titulo')} />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
        <p className="pt-3 text-xl font-semibold">{t('exportar.titulo')}</p>

        {!atual && (
          <p role="status" className="text-xl text-muted-foreground">
            {t('exportar.buscando')}
          </p>
        )}

        {mensagem && (
          <p role={resultado && !resultado.ok ? 'alert' : 'status'} className="text-2xl leading-snug font-semibold">
            {mensagem}
          </p>
        )}

        {atual && quantidade === 0 && !naoExiste && !todo && resultado?.ok && (
          <p className="text-lg text-muted-foreground">
            {t('exportar.periodoUsado', { de: dataFalada(cmd.de, hoje), ate: dataFalada(cmd.ate, hoje) })}
          </p>
        )}

        {naoExiste && sugestoes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-lg font-medium text-muted-foreground">{t('exportar.sugestoesTitulo')}</p>
            {sugestoes.map((s) => (
              <Button key={s.chave} type="button" variant="outline" className="h-14 text-xl" onClick={() => setFavorecido(s.nome)}>
                {s.nome}
              </Button>
            ))}
          </div>
        )}

        {quantidade > 0 && (
          <div className={cn('flex flex-col gap-3', previa.gerando && 'opacity-60')}>
            {previa.urls.map((url, i) => (
              // Prévia = o próprio PNG (blob local) que será enviado.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={t('exportar.previaAlt', { numero: i + 1, total: previa.urls.length })}
                className="w-full rounded-lg border bg-white"
              />
            ))}
            {previa.erro && (
              <p role="alert" className="text-lg font-medium text-destructive">
                {t('exportar.erro')}
              </p>
            )}
          </div>
        )}

        <p className="text-base text-muted-foreground">{t('ouvi', { texto: `“${texto}”` })}</p>
        <p role="status" aria-live="polite" className={cn('min-h-6 text-lg font-medium', aviso?.erro && 'text-destructive')}>
          {aviso?.texto}
        </p>
      </div>

      <div className="border-t bg-background px-6 pt-3 pb-5">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2">
          {pronto && (
            <>
              <Button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    const r = await compartilharPng(previa.blobs, base, te('tituloCompartilhar', { nome: nome || te('todos') }))
                    return r === 'compartilhado' ? t('exportar.compartilhado') : r === 'baixado' ? t('exportar.baixado') : null
                  })
                }
                className="h-16 w-full gap-2 bg-marca text-xl font-semibold text-marca-foreground hover:bg-marca/90"
              >
                <Share2Icon aria-hidden className="size-6" />
                {t('exportar.compartilhar')}
              </Button>
              {/* Na voz só a imagem (PNG): o PDF fica na tela de exportar, como ação secundária. */}
              <Button
                type="button"
                variant="outline"
                disabled={ocupado}
                onClick={() =>
                  executar(async () => {
                    baixarPng(previa.blobs, base)
                    return t('exportar.baixado')
                  })
                }
                className="h-14 w-full gap-2 text-lg"
              >
                <DownloadIcon aria-hidden className="size-5" />
                {t('exportar.baixar')}
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={aoFalarDeNovo} className="h-14 w-full text-lg">
            {t('falarDeNovo')}
          </Button>
          <div className="flex items-center justify-center gap-2">
            <Link
              href={ajustar}
              onClick={aoFechar}
              className={cn(buttonVariants({ variant: 'ghost' }), 'h-12 text-base font-medium underline underline-offset-4')}
            >
              {t('exportar.ajustar')}
            </Link>
            <Button type="button" variant="ghost" onClick={aoFechar} className="h-12 text-base font-medium underline underline-offset-4">
              {t('exportar.fechar')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
