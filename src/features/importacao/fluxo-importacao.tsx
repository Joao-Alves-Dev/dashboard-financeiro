'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2Icon, PlusIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { classeValor } from '@/lib/cores'
import { formatarBRL } from '@/lib/money'
import { confirmarImportacao, previaImportacao } from './actions'
import { Previa, type OpcaoCategoriaPrevia } from './previa'
import { validarArquivoUpload } from './schemas'
import type { Previa as PreviaDados } from './servico'
import type { MapeamentoCsv } from './tipos'

export type OpcaoContaImportacao = { id: string; nome: string }

type Etapa = 'arquivo' | 'mapeamento' | 'previa' | 'resultado'

type Props = {
  workspaceId: string
  contas: OpcaoContaImportacao[]
  categorias: OpcaoCategoriaPrevia[]
}

const classeSelect =
  'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

const MAP_VAZIO: MapeamentoCsv = { colData: '', colDescricao: '', colValor: '', inverterSinal: false }

export function FluxoImportacao({ workspaceId, contas, categorias }: Props) {
  const t = useTranslations('importacao')
  const [etapa, setEtapa] = useState<Etapa>('arquivo')
  const [contaId, setContaId] = useState<string>(contas[0]?.id ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [colunas, setColunas] = useState<string[]>([])
  const [mapeamento, setMapeamento] = useState<MapeamentoCsv>(MAP_VAZIO)
  const [mapeamentoSalvo, setMapeamentoSalvo] = useState(false)
  const [previa, setPrevia] = useState<PreviaDados | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set())
  const [categoriasEscolhidas, setCategoriasEscolhidas] = useState<Map<number, string | null>>(new Map())
  const [resultado, setResultado] = useState<{ inseridos: number; ignorados: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const inputArquivo = useRef<HTMLInputElement>(null)

  function reiniciar() {
    setEtapa('arquivo')
    setArquivo(null)
    setPrevia(null)
    setColunas([])
    setMapeamento(MAP_VAZIO)
    setMapeamentoSalvo(false)
    setSelecionadas(new Set())
    setCategoriasEscolhidas(new Map())
    setResultado(null)
    setErro(null)
    if (inputArquivo.current) inputArquivo.current.value = ''
  }

  function montarForm(map: MapeamentoCsv | null): FormData {
    const fd = new FormData()
    fd.set('workspaceId', workspaceId)
    fd.set('contaId', contaId)
    fd.set('arquivo', arquivo as File)
    if (map) {
      fd.set('colData', map.colData)
      fd.set('colDescricao', map.colDescricao)
      fd.set('colValor', map.colValor)
      fd.set('inverterSinal', String(map.inverterSinal))
    }
    return fd
  }

  function receberPrevia(p: PreviaDados, mapUsado: MapeamentoCsv | null) {
    setPrevia(p)
    if (p.precisaMapeamento) {
      setColunas(p.colunasCsv ?? [])
      setMapeamento(p.mapeamentoSalvo ?? MAP_VAZIO)
      setMapeamentoSalvo(Boolean(p.mapeamentoSalvo))
      setEtapa('mapeamento')
      return
    }
    if (mapUsado) setMapeamento(mapUsado)
    setSelecionadas(new Set(p.linhas.flatMap((l, i) => (l.duplicado ? [] : [i]))))
    setCategoriasEscolhidas(new Map())
    setEtapa('previa')
  }

  function analisar(map: MapeamentoCsv | null) {
    setErro(null)
    if (!arquivo) {
      setErro(t('erros.semArquivo'))
      return
    }
    if (!contaId) {
      setErro(t('erros.contaObrigatoria'))
      return
    }
    const v = validarArquivoUpload(arquivo.name, arquivo.size)
    if (!v.ok) {
      setErro(t(v.chave.replace(/^importacao\./, '')))
      return
    }
    iniciar(async () => {
      const r = await previaImportacao(montarForm(map))
      if (!r.ok) setErro(r.erro)
      else receberPrevia(r.data, map)
    })
  }

  const categoriaDe = (i: number): string | null =>
    categoriasEscolhidas.has(i) ? (categoriasEscolhidas.get(i) ?? null) : (previa?.linhas[i]?.categoriaId ?? null)

  const totais = useMemo(() => {
    const linhas = previa?.linhas ?? []
    const novas = linhas.filter((l) => !l.duplicado).length
    let soma = 0
    for (const i of selecionadas) soma += linhas[i]?.valorCentavos ?? 0
    return { novas, duplicadas: linhas.length - novas, erros: previa?.erros.length ?? 0, soma }
  }, [previa, selecionadas])

  function confirmar() {
    if (!previa) return
    setErro(null)
    const linhas = [...selecionadas]
      .sort((a, b) => a - b)
      .map((i) => {
        const l = previa.linhas[i]
        return {
          data: l.data,
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          idExterno: l.idExterno,
          categoriaId: categoriaDe(i),
        }
      })
    iniciar(async () => {
      const r = await confirmarImportacao(
        workspaceId,
        contaId,
        arquivo?.name ?? '',
        previa.formato,
        linhas,
        previa.formato === 'csv' ? mapeamento : null,
      )
      if (r.ok) {
        setResultado(r.data)
        setEtapa('resultado')
      } else {
        setErro(r.erro)
      }
    })
  }

  if (contas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium">{t('semConta')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('semContaDescricao')}</p>
        <Link href={`/w/${workspaceId}/config?aba=contas`} className={`${buttonVariants()} mt-4`}>
          <PlusIcon className="size-4" />
          {t('criarConta')}
        </Link>
      </div>
    )
  }

  const mapeamentoCompleto = mapeamento.colData && mapeamento.colDescricao && mapeamento.colValor

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={t('titulo')}>
        {(['arquivo', 'mapeamento', 'previa', 'resultado'] as const).map((e) => (
          <li key={e} aria-current={e === etapa ? 'step' : undefined} className={e === etapa ? 'font-semibold' : 'text-muted-foreground'}>
            {t(`passos.${e}`)}
          </li>
        ))}
      </ol>

      {erro && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      )}

      {etapa === 'arquivo' && (
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            analisar(null)
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conta-importacao">{t('conta')}</Label>
            <select
              id="conta-importacao"
              className={classeSelect}
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="arquivo-extrato">{t('arquivo')}</Label>
            <Input
              id="arquivo-extrato"
              ref={inputArquivo}
              type="file"
              accept=".ofx,.csv"
              className="h-auto py-2"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null)
                setErro(null)
              }}
            />
            <p className="text-xs text-muted-foreground">{t('arquivoDica')}</p>
          </div>
          <Button type="submit" disabled={pendente || !arquivo} className="w-full sm:w-fit">
            {pendente ? t('analisando') : t('continuar')}
          </Button>
        </form>
      )}

      {etapa === 'mapeamento' && (
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            analisar(mapeamento)
          }}
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('mapeamento.titulo')}</h2>
            <p className="text-sm text-muted-foreground">{t('mapeamento.descricao')}</p>
            {mapeamentoSalvo && <p className="mt-1 text-sm text-muted-foreground">{t('mapeamento.salvo')}</p>}
          </div>
          {(
            [
              ['colData', 'mapeamento.data'],
              ['colDescricao', 'mapeamento.descricaoCol'],
              ['colValor', 'mapeamento.valor'],
            ] as const
          ).map(([campo, rotulo]) => (
            <div key={campo} className="flex flex-col gap-1.5">
              <Label htmlFor={`map-${campo}`}>{t(rotulo)}</Label>
              <select
                id={`map-${campo}`}
                className={classeSelect}
                value={mapeamento[campo]}
                onChange={(e) => setMapeamento((m) => ({ ...m, [campo]: e.target.value }))}
              >
                <option value="">{t('mapeamento.escolha')}</option>
                {colunas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={mapeamento.inverterSinal}
              onChange={(e) => setMapeamento((m) => ({ ...m, inverterSinal: e.target.checked }))}
            />
            <span>
              {t('mapeamento.inverter')}
              <span className="block text-xs text-muted-foreground">{t('mapeamento.inverterDica')}</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reiniciar}>
              {t('voltar')}
            </Button>
            <Button type="submit" disabled={pendente || !mapeamentoCompleto}>
              {pendente ? t('analisando') : t('mapeamento.gerarPrevia')}
            </Button>
          </div>
        </form>
      )}

      {etapa === 'previa' && previa && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{t('previa.titulo')}</h2>
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm"
            aria-live="polite"
          >
            <span>{t('previa.novas', { n: totais.novas })}</span>
            <span>{t('previa.duplicadas', { n: totais.duplicadas })}</span>
            <span className={totais.erros > 0 ? 'text-destructive' : undefined}>{t('previa.comErro', { n: totais.erros })}</span>
            <span className="ml-auto">
              {t('previa.soma')}:{' '}
              <strong className={`tabular-nums ${classeValor(totais.soma)}`}>{formatarBRL(totais.soma)}</strong>
            </span>
          </div>

          {totais.novas === 0 && previa.linhas.length > 0 && <p className="text-sm">{t('previa.nadaNovo')}</p>}

          <Previa
            linhas={previa.linhas}
            erros={previa.erros}
            categorias={categorias}
            selecionadas={selecionadas}
            aoAlternar={(i, marcado) =>
              setSelecionadas((prev) => {
                const novo = new Set(prev)
                if (marcado) novo.add(i)
                else novo.delete(i)
                return novo
              })
            }
            aoAlternarTodas={(marcado) =>
              setSelecionadas(marcado ? new Set(previa.linhas.flatMap((l, i) => (l.duplicado ? [] : [i]))) : new Set())
            }
            categoriaDe={categoriaDe}
            aoMudarCategoria={(i, cat) => setCategoriasEscolhidas((prev) => new Map(prev).set(i, cat))}
          />

          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
            <span className="text-sm text-muted-foreground">{t('previa.selecionadas', { n: selecionadas.size })}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reiniciar} disabled={pendente}>
                {t('previa.cancelar')}
              </Button>
              <Button onClick={confirmar} disabled={pendente || selecionadas.size === 0}>
                {pendente ? t('previa.importando') : t('previa.importar', { n: selecionadas.size })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {etapa === 'resultado' && resultado && (
        <div className="flex max-w-xl flex-col gap-4 rounded-lg border p-6" role="status">
          <div className="flex items-center gap-2">
            <CheckCircle2Icon className="size-6 text-green-700 dark:text-green-400" />
            <h2 className="text-lg font-semibold tracking-tight">{t('resultado.titulo')}</h2>
          </div>
          <p>{t('resultado.resumo', { inseridos: resultado.inseridos, ignorados: resultado.ignorados })}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/w/${workspaceId}/lancamentos`} className={buttonVariants()}>
              {t('resultado.verLancamentos')}
            </Link>
            <Button variant="outline" onClick={reiniciar}>
              {t('resultado.outra')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
