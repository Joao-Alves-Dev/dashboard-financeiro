'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDownIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { ConfirmarDialogo } from '@/components/confirmar-dialogo'
import { Button } from '@/components/ui/button'
import { classeValor } from '@/lib/cores'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/utils'
import { excluirAporte, excluirMeta } from './actions'
import type { CalculoMeta } from './calcular-meta'
import { FormAporte } from './form-aporte'
import { FormMeta } from './form-meta'
import { ProgressoMeta } from './progresso-meta'
import { SituacaoMetaRotulo } from './situacao-meta'

export type MetaCard = {
  id: string
  nome: string
  valorAlvoCentavos: number
  dataAlvo: string
  guardado: number
  calculo: CalculoMeta
}

export type AporteCard = { id: string; data: string; valorCentavos: number; observacao: string | null }

type Props = {
  workspaceId: string
  meta: MetaCard
  /** Aportes desta meta, do mais recente para o mais antigo. */
  aportes: AporteCard[]
}

export function CardMeta({ workspaceId, meta, aportes }: Props) {
  const t = useTranslations('metas')
  const tc = useTranslations('comum')
  const idHistorico = useId()
  const [editando, setEditando] = useState(false)
  const [aportando, setAportando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [aporteParaExcluir, setAporteParaExcluir] = useState<AporteCard | null>(null)

  const c = meta.calculo
  const concluida = c.situacao === 'concluida'
  const vencida = c.situacao === 'vencida'
  // Quanto falta por mês além da sobra média informada (consistente com os dois números mostrados).
  const faltaPorMes = c.necessarioPorMes - c.sobraMedia

  return (
    <article
      aria-labelledby={`${idHistorico}-nome`}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`${idHistorico}-nome`} className="text-base leading-snug font-medium break-words">
            {meta.nome}
          </h2>
          <SituacaoMetaRotulo situacao={c.situacao} />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t('acoes.editar')} onClick={() => setEditando(true)}>
            <PencilIcon aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t('acoes.excluir')} onClick={() => setExcluindo(true)}>
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      </header>

      <ProgressoMeta nome={meta.nome} guardado={meta.guardado} alvo={meta.valorAlvoCentavos} situacao={c.situacao} />

      {concluida ? (
        <p className="text-sm">{t('concluidaTexto')}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('prazo', { data: formatarDataBR(meta.dataAlvo) })}
            {vencida ? null : (
              <>
                <span aria-hidden="true"> · </span>
                {t('mesesRestantes', { n: c.mesesRestantes })}
              </>
            )}
          </p>
          {vencida ? (
            <p className="text-sm font-medium text-(--status-critico)">{t('vencidaTexto', { falta: formatarBRL(c.faltam) })}</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <dt className="text-muted-foreground">{t('necessario')}</dt>
                  <dd className="font-semibold tabular-nums">{formatarBRL(c.necessarioPorMes)}</dd>
                </div>
                <div className="flex min-w-0 flex-col">
                  <dt className="text-muted-foreground">{t('sobraMedia')}</dt>
                  <dd className={cn('font-semibold tabular-nums', c.sobraMedia < 0 && 'text-(--status-critico)')}>
                    {formatarBRL(c.sobraMedia)}
                  </dd>
                </div>
              </dl>
              {c.situacao === 'atrasada' ? (
                <p className="text-sm font-medium text-(--status-critico)">{t('faltaPorMes', { valor: formatarBRL(faltaPorMes) })}</p>
              ) : null}
            </>
          )}
          <p className="text-xs text-muted-foreground">{t('sobraAjuda')}</p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-10 px-4" onClick={() => setAportando(true)}>
          {t('aporte.botao')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 px-4"
          aria-expanded={historicoAberto}
          aria-controls={idHistorico}
          onClick={() => setHistoricoAberto((v) => !v)}
        >
          {historicoAberto ? t('historico.ocultar') : t('historico.mostrar', { n: aportes.length })}
          <ChevronDownIcon aria-hidden="true" className={cn('transition-transform', historicoAberto && 'rotate-180')} />
        </Button>
      </div>

      <div id={idHistorico} hidden={!historicoAberto}>
        {historicoAberto ? (
          aportes.length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">{t('historico.vazio')}</p>
          ) : (
            <ul aria-label={t('historico.titulo', { meta: meta.nome })} className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/10">
              {aportes.map((a) => {
                const retirada = a.valorCentavos < 0
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="tabular-nums">
                        <span className="font-medium">{retirada ? t('historico.retirada') : t('historico.aporte')}</span>
                        <span aria-hidden="true"> · </span>
                        {formatarDataBR(a.data)}
                      </span>
                      {a.observacao ? <span className="text-xs break-words text-muted-foreground">{a.observacao}</span> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={cn('font-semibold tabular-nums', classeValor(a.valorCentavos))}>{formatarBRL(a.valorCentavos)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={t('historico.excluir')}
                        onClick={() => setAporteParaExcluir(a)}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </div>

      <FormMeta
        workspaceId={workspaceId}
        meta={{ id: meta.id, nome: meta.nome, valorAlvoCentavos: meta.valorAlvoCentavos, dataAlvo: meta.dataAlvo }}
        aberto={editando}
        aoMudar={setEditando}
      />
      <FormAporte
        workspaceId={workspaceId}
        meta={{ id: meta.id, nome: meta.nome, guardado: meta.guardado }}
        aberto={aportando}
        aoMudar={setAportando}
      />

      <ConfirmarDialogo
        aberto={excluindo}
        aoMudar={setExcluindo}
        titulo={t('excluirTitulo', { nome: meta.nome })}
        texto={aportes.length > 0 ? t('excluirComAportes', { n: aportes.length }) : t('excluirTexto')}
        rotuloConfirmar={tc('excluir')}
        aoConfirmar={async () => {
          const r = await excluirMeta(workspaceId, meta.id, aportes.length > 0)
          return r.ok ? null : r.erro
        }}
      />
      <ConfirmarDialogo
        aberto={aporteParaExcluir !== null}
        aoMudar={(v) => {
          if (!v) setAporteParaExcluir(null)
        }}
        titulo={t('historico.excluirTitulo')}
        texto={
          aporteParaExcluir
            ? t('historico.excluirTexto', {
                tipo: aporteParaExcluir.valorCentavos < 0 ? t('historico.retirada') : t('historico.aporte'),
                valor: formatarBRL(Math.abs(aporteParaExcluir.valorCentavos)),
                data: formatarDataBR(aporteParaExcluir.data),
              })
            : ''
        }
        rotuloConfirmar={tc('excluir')}
        aoConfirmar={async () => {
          if (!aporteParaExcluir) return null
          const r = await excluirAporte(workspaceId, aporteParaExcluir.id)
          return r.ok ? null : r.erro
        }}
      />
    </article>
  )
}
