'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { classeValor } from '@/lib/cores'
import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'
import type { ErroLinha } from './tipos'
import type { LinhaPrevia } from './servico'

export type OpcaoCategoriaPrevia = { id: string; nome: string }

type Props = {
  linhas: LinhaPrevia[]
  erros: ErroLinha[]
  categorias: OpcaoCategoriaPrevia[]
  /** Índices (na lista `linhas`) marcados para importar. */
  selecionadas: Set<number>
  aoAlternar: (indice: number, marcado: boolean) => void
  aoAlternarTodas: (marcado: boolean) => void
  /** Categoria efetiva de cada linha (sugestão ou escolha do usuário). */
  categoriaDe: (indice: number) => string | null
  aoMudarCategoria: (indice: number, categoriaId: string | null) => void
}

const PASSO = 200
const classeSelect =
  'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function Previa({
  linhas,
  erros,
  categorias,
  selecionadas,
  aoAlternar,
  aoAlternarTodas,
  categoriaDe,
  aoMudarCategoria,
}: Props) {
  const t = useTranslations('importacao.previa')
  const [limite, setLimite] = useState(PASSO)

  const indicesNovas = useMemo(
    () => linhas.map((l, i) => (l.duplicado ? -1 : i)).filter((i) => i >= 0),
    [linhas],
  )
  const todasMarcadas = indicesNovas.length > 0 && indicesNovas.every((i) => selecionadas.has(i))
  const visiveis = linhas.slice(0, limite)

  function seletorCategoria(i: number, l: LinhaPrevia) {
    return (
      <select
        className={classeSelect}
        aria-label={t('categoriaDe', { descricao: l.descricao })}
        value={categoriaDe(i) ?? ''}
        disabled={l.duplicado}
        onChange={(e) => aoMudarCategoria(i, e.target.value || null)}
      >
        <option value="">{t('semCategoria')}</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {indicesNovas.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={todasMarcadas}
            onChange={(e) => aoAlternarTodas(e.target.checked)}
          />
          {t('selecionarTodas')}
        </label>
      )}

      {/* Tabela (md+) */}
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">{t('selecionar')}</span>
              </TableHead>
              <TableHead>{t('colunas.data')}</TableHead>
              <TableHead>{t('colunas.descricao')}</TableHead>
              <TableHead className="w-56">{t('colunas.categoria')}</TableHead>
              <TableHead className="text-right">{t('colunas.valor')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((l, i) => (
              <TableRow key={i} className={l.duplicado ? 'opacity-50' : undefined} data-duplicado={l.duplicado || undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selecionadas.has(i)}
                    disabled={l.duplicado}
                    aria-label={`${t('selecionar')}: ${l.descricao}`}
                    onChange={(e) => aoAlternar(i, e.target.checked)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatarDataBR(l.data)}</TableCell>
                <TableCell className="max-w-xs">
                  <span className="line-clamp-2">{l.descricao}</span>
                  {l.duplicado && (
                    <Badge variant="outline" className="ml-2" title={t('duplicadaDica')}>
                      {t('duplicadaBadge')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {seletorCategoria(i, l)}
                </TableCell>
                <TableCell className={`whitespace-nowrap text-right font-medium tabular-nums ${classeValor(l.valorCentavos)}`}>
                  {formatarBRL(l.valorCentavos)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cartões (< md) */}
      <ul className="flex flex-col gap-2 md:hidden">
        {visiveis.map((l, i) => (
          <li
            key={i}
            className={`rounded-lg border p-3 ${l.duplicado ? 'opacity-50' : ''}`}
            data-duplicado={l.duplicado || undefined}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-primary"
                checked={selecionadas.has(i)}
                disabled={l.duplicado}
                aria-label={`${t('selecionar')}: ${l.descricao}`}
                onChange={(e) => aoAlternar(i, e.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{l.descricao}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatarDataBR(l.data)}</p>
                {l.duplicado && (
                  <Badge variant="outline" className="mt-1">
                    {t('duplicadaBadge')}
                  </Badge>
                )}
              </div>
              <p className={`whitespace-nowrap text-right font-semibold tabular-nums ${classeValor(l.valorCentavos)}`}>
                {formatarBRL(l.valorCentavos)}
              </p>
            </div>
            <div className="mt-2 pl-8">
              {seletorCategoria(i, l)}
            </div>
          </li>
        ))}
      </ul>

      {linhas.length > limite && (
        <Button variant="outline" onClick={() => setLimite((n) => n + PASSO)}>
          {t('mostrarMais', { n: linhas.length - limite })}
        </Button>
      )}

      {erros.length > 0 && (
        <section aria-labelledby="titulo-erros" className="rounded-lg border border-destructive/40 p-3">
          <h3 id="titulo-erros" className="text-sm font-semibold text-destructive">
            {t('errosTitulo')} ({erros.length})
          </h3>
          <p className="text-xs text-muted-foreground">{t('errosDescricao')}</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {erros.map((e, i) => (
              <li key={i}>{t('errosLinha', { linha: e.linha, motivo: e.motivo })}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
