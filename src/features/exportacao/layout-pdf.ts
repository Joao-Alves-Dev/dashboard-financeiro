import { quebrarTexto, type Medir, type Texto } from './layout-relatorio'
import type { Relatorio } from './relatorio'

/**
 * Layout A4 (PDF): título, período, cabeçalho Data | Anotações | Valor, linhas com zebra suave. É o layout
 * anterior à Task 15d, mantido para o PDF; o PNG usa o layout de `layout-relatorio.ts` (cartão, ponto, barra).
 */

export type Tamanhos = {
  titulo: number
  periodo: number
  cabecalho: number
  linha: number
  total: number
  rodape: number
  margem: number
  padLinha: number
}

export const LINHAS_POR_PAGINA_PDF_PADRAO = 25
export const TAMANHOS_PADRAO: Tamanhos = {
  titulo: 56,
  periodo: 34,
  cabecalho: 30,
  linha: 36,
  total: 40,
  rodape: 26,
  margem: 56,
  padLinha: 18,
}

/** Proporção entre o tamanho da fonte e a altura da caixa de uma linha de texto. */
const ALTURA_LINHA = 1.25
const MAX_LINHAS_TITULO = 3
const MAX_LINHAS_ANOTACAO = 2

export type LinhaLayout = { y: number; altura: number; zebra: boolean; separadorY: number; textos: Texto[] }

export type PaginaPdf = {
  altura: number
  titulo: Texto[]
  periodo: Texto
  cabecalho: { y: number; altura: number; linhaY: number; textos: Texto[] }
  linhas: LinhaLayout[]
  total?: { y: number; altura: number; linhaY: number; textos: Texto[] }
  rodape?: Texto
}

export type LayoutPdf = { largura: number; margem: number; paginas: PaginaPdf[] }

export type OpcoesLayoutPdf = {
  tamanhos?: Tamanhos
  /** Máximo de linhas por página (padrão 25). */
  linhasPorPagina?: number
  /** Altura fixa da página: empacota linhas até caber. Sem isso, a altura segue o conteúdo. */
  alturaMaxima?: number
  rotuloRodape?: (pagina: number, total: number) => string
}

/**
 * Posições de tudo que vai na imagem/página (puro; a medida do texto é injetada). Cada parte repete
 * título, período e cabeçalho; o total (se houver) fica só na última; rodapé "Parte i/N" quando há mais
 * de uma. O desenho (canvas ou PDF) apenas percorre este resultado.
 */
export function calcularLayoutPdf(
  r: Relatorio,
  largura: number,
  medir: Medir,
  op: OpcoesLayoutPdf = {},
): LayoutPdf {
  const T = op.tamanhos ?? TAMANHOS_PADRAO
  const porPagina = op.linhasPorPagina ?? LINHAS_POR_PAGINA_PDF_PADRAO
  const rotuloRodape = op.rotuloRodape ?? ((i, n) => `Parte ${i}/${n}`)
  const xDir = largura - T.margem
  const W = largura - 2 * T.margem

  // Colunas: Data e Valor ocupam o que o conteúdo pede; Anotações fica com o resto.
  const gap = T.linha * 0.7
  const dataW = Math.max(
    medir('00/00/0000', T.linha, false),
    medir('Data', T.cabecalho, true),
    ...r.linhas.map((l) => medir(l.data, T.linha, false)),
  )
  const valorW = Math.max(
    medir('Valor', T.cabecalho, true),
    ...r.linhas.map((l) => medir(l.valor, T.linha, true)),
    r.total ? medir(r.total, T.total, true) : 0,
  )
  const anotX = T.margem + dataW + gap
  const anotW = Math.max(T.linha * 4, xDir - valorW - gap - anotX)

  const tituloLinhas = quebrarTexto(r.titulo, W, (s) => medir(s, T.titulo, true), MAX_LINHAS_TITULO)
  const txt = (
    texto: string,
    x: number,
    y: number,
    tamanho: number,
    negrito: boolean,
    alinhar: 'esq' | 'dir' = 'esq',
    cor: Texto['cor'] = 'principal',
  ): Texto => ({ texto, x, y, h: tamanho * ALTURA_LINHA, tamanho, negrito, alinhar, cor })

  // Bloco fixo do topo (igual em todas as partes).
  let y = T.margem
  const titulo = tituloLinhas.map((l) => {
    const t = txt(l, T.margem, y, T.titulo, true)
    y += T.titulo * 1.2
    return t
  })
  y += T.titulo * 0.12
  const periodo = txt(r.periodo, T.margem, y, T.periodo, false, 'esq', 'secundaria')
  y += T.periodo * 1.3 + T.periodo * 0.8
  const cabY = y
  const cabAltura = T.cabecalho * 1.3 + 28
  const cabTextoY = cabY + 14
  const cabecalho = {
    y: cabY,
    altura: cabAltura,
    linhaY: cabY + cabAltura,
    textos: [
      txt('Data', T.margem, cabTextoY, T.cabecalho, true),
      txt('Anotações', anotX, cabTextoY, T.cabecalho, true),
      txt('Valor', xDir, cabTextoY, T.cabecalho, true, 'dir'),
    ],
  }
  const topoLinhas = cabecalho.linhaY

  // Linhas, já com altura (anotação pode ocupar duas linhas).
  const preparadas = r.linhas.map((l, i) => {
    const anot = quebrarTexto(l.anotacao, anotW, (s) => medir(s, T.linha, false), MAX_LINHAS_ANOTACAO)
    return { l, i, anot, altura: anot.length * T.linha * ALTURA_LINHA + 2 * T.padLinha }
  })
  const totalAltura = T.total * 1.3 + 2 * T.padLinha
  const rodapeAltura = T.rodape * 1.3
  const reservaRodape = rodapeAltura + T.margem * 0.6
  const limite = op.alturaMaxima === undefined ? Infinity : op.alturaMaxima - T.margem * 0.6 - reservaRodape

  // Paginação: por quantidade e, se houver altura fixa, também por espaço.
  const grupos: (typeof preparadas)[] = []
  let atual: typeof preparadas = []
  let usado = topoLinhas
  for (const p of preparadas) {
    if (atual.length > 0 && (atual.length >= porPagina || usado + p.altura > limite)) {
      grupos.push(atual)
      atual = []
      usado = topoLinhas
    }
    atual.push(p)
    usado += p.altura
  }
  grupos.push(atual)
  // Total sem espaço na última página: vai sozinho para uma página nova.
  if (r.total && atual.length > 0 && usado + totalAltura > limite) grupos.push([])

  const n = grupos.length
  const paginas = grupos.map((grupo, pi): PaginaPdf => {
    let yy = topoLinhas
    const linhas = grupo.map((p): LinhaLayout => {
      const base = yy
      const textos: Texto[] = [txt(p.l.data, T.margem, base + T.padLinha, T.linha, false)]
      p.anot.forEach((a, k) => {
        if (a !== '') textos.push(txt(a, anotX, base + T.padLinha + k * T.linha * ALTURA_LINHA, T.linha, false))
      })
      textos.push(txt(p.l.valor, xDir, base + T.padLinha, T.linha, true, 'dir'))
      yy += p.altura
      return { y: base, altura: p.altura, zebra: p.i % 2 === 1, separadorY: base + p.altura, textos }
    })
    let total: PaginaPdf['total']
    if (r.total && pi === n - 1) {
      const ty = yy + T.padLinha
      total = {
        y: yy,
        altura: totalAltura,
        linhaY: yy,
        textos: [
          txt('Total', T.margem, ty, T.total, true),
          txt(r.total, xDir, ty, T.total, true, 'dir'),
        ],
      }
      yy += totalAltura
    }
    const altura = op.alturaMaxima ?? yy + (n > 1 ? T.rodape * 0.6 + rodapeAltura : 0) + T.margem
    let rodape: Texto | undefined
    if (n > 1) {
      const ry = op.alturaMaxima === undefined ? yy + T.rodape * 0.6 : altura - T.margem * 0.6 - rodapeAltura
      rodape = txt(rotuloRodape(pi + 1, n), xDir, ry, T.rodape, false, 'dir', 'secundaria')
    }
    return { altura, titulo, periodo, cabecalho, linhas, total, rodape }
  })

  return { largura, margem: T.margem, paginas }
}
