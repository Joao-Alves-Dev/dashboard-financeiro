import type { Relatorio } from './relatorio'

/** Mede a largura de um texto na unidade do layout (px no PNG, pt no PDF). */
export type Medir = (texto: string, tamanho: number, negrito: boolean) => number

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

export const LARGURA_PNG = 1080
export const LINHAS_POR_IMAGEM = 25
/** Letras grandes para ler no celular (e por quem enxerga pouco): linhas em 36px numa imagem de 1080px. */
export const TAMANHOS_PNG: Tamanhos = {
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

export type Texto = {
  texto: string
  /** Esquerda do texto (alinhar 'esq') ou borda direita (alinhar 'dir'). */
  x: number
  /** Topo da caixa da linha; a altura é `h`. */
  y: number
  h: number
  tamanho: number
  negrito: boolean
  alinhar: 'esq' | 'dir'
  cor: 'principal' | 'secundaria'
}

export type LinhaLayout = { y: number; altura: number; zebra: boolean; separadorY: number; textos: Texto[] }

export type PaginaLayout = {
  altura: number
  titulo: Texto[]
  periodo: Texto
  cabecalho: { y: number; altura: number; linhaY: number; textos: Texto[] }
  linhas: LinhaLayout[]
  total?: { y: number; altura: number; linhaY: number; textos: Texto[] }
  rodape?: Texto
}

export type LayoutRelatorio = { largura: number; margem: number; paginas: PaginaLayout[] }

export type OpcoesLayout = {
  tamanhos?: Tamanhos
  /** Máximo de linhas por imagem/página (padrão 25). */
  linhasPorPagina?: number
  /** Altura fixa da página (PDF): empacota linhas até caber. Sem isso, a altura segue o conteúdo. */
  alturaMaxima?: number
  rotuloRodape?: (pagina: number, total: number) => string
}

/**
 * Quebra em linhas que cabem em `larguraMax`, por palavras. Mais que `maxLinhas`: a última termina
 * em reticências. Palavra maior que a linha é cortada por caractere.
 */
export function quebrarTexto(texto: string, larguraMax: number, medir: (s: string) => number, maxLinhas: number): string[] {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  if (limpo === '') return ['']
  if (medir(limpo) <= larguraMax) return [limpo]

  const caber = (s: string) => medir(s) <= larguraMax
  const palavras = limpo.split(' ')
  const linhas: string[] = []
  let atual = ''
  for (let p of palavras) {
    // Palavra sozinha maior que a linha: fatia por caractere.
    while (!caber(p)) {
      let n = p.length - 1
      while (n > 1 && !caber(p.slice(0, n))) n--
      if (atual !== '') {
        linhas.push(atual)
        atual = ''
      }
      linhas.push(p.slice(0, n))
      p = p.slice(n)
    }
    const tentativa = atual === '' ? p : `${atual} ${p}`
    if (caber(tentativa)) atual = tentativa
    else {
      linhas.push(atual)
      atual = p
    }
  }
  if (atual !== '') linhas.push(atual)

  if (linhas.length <= maxLinhas) return linhas
  const ficam = linhas.slice(0, maxLinhas)
  let ultima = ficam[maxLinhas - 1]
  while (ultima.length > 0 && !caber(`${ultima}…`)) ultima = ultima.slice(0, -1).trimEnd()
  ficam[maxLinhas - 1] = `${ultima}…`
  return ficam
}

/**
 * Posições de tudo que vai na imagem/página (puro; a medida do texto é injetada). Cada parte repete
 * título, período e cabeçalho; o total (se houver) fica só na última; rodapé "Parte i/N" quando há mais
 * de uma. O desenho (canvas ou PDF) apenas percorre este resultado.
 */
export function calcularLayoutRelatorio(
  r: Relatorio,
  largura: number,
  medir: Medir,
  op: OpcoesLayout = {},
): LayoutRelatorio {
  const T = op.tamanhos ?? TAMANHOS_PNG
  const porPagina = op.linhasPorPagina ?? LINHAS_POR_IMAGEM
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
  const paginas = grupos.map((grupo, pi): PaginaLayout => {
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
    let total: PaginaLayout['total']
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
