import type { Relatorio } from './relatorio'

/** Mede a largura de um texto na unidade do layout (px no PNG, pt no PDF). */
export type Medir = (texto: string, tamanho: number, negrito: boolean) => number

/**
 * Layout do PNG, a partir da imagem de referência (1800px de largura): fundo cinza claro; título em negrito
 * grande com uma barra vertical e o nome do favorecido na mesma linha; um cartão branco de cantos bem
 * arredondados com o cabeçalho "Data | Anotações | Valor" e linhas de 170px (ponto azul, data, anotação
 * opcional, valor em negrito à direita). Sem zebra. As medidas abaixo foram tiradas da referência.
 */
export const LARGURA_PNG = 1800
/** Acima disso o relatório vira várias imagens (cada uma com título, cabeçalho e rodapé "Parte i/N"). */
export const LINHAS_POR_IMAGEM = 12

/**
 * Fonte do canvas. O Inter (a fonte da referência) só entra se estiver instalada no aparelho: `next/font`
 * não alcança um canvas, então a pilha cai para a fonte do sistema (alto contraste e acentos garantidos).
 */
export const FONTE_PNG = 'Inter, system-ui, Arial, sans-serif'

const M = {
  margem: 100, // esquerda do título e do cartão; margem inferior
  topoTitulo: 80, // topo da barra e do título
  titulo: 72,
  barraW: 8,
  barraH: 80,
  folgaBarra: 40, // entre o título e a barra, e entre a barra e o nome
  cartaoY: 260,
  cartaoW: 1600,
  raio: 40,
  cabecalhoH: 130, // topo do cartão até a linha sob o cabeçalho
  cabecalho: 28,
  linhaH: 170,
  linha: 40,
  anotacao: 34,
  totalH: 150,
  pontoRaio: 16,
  rodape: 28,
  // posições X (largura 1800)
  dataLabelX: 170,
  pontoX: 190,
  dataX: 240,
  anotX: 860,
  valorX: 1630,
  folgaValor: 50, // entre o fim da anotação e o começo do valor
} as const

/** Proporção entre o tamanho da fonte e a altura da caixa de uma linha de texto. */
const ALTURA_LINHA = 1.25
const MAX_LINHAS_NOME = 2
const MAX_LINHAS_ANOTACAO = 2
const SEPARADOR_TITULO = ' | '

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
  /** 'principal' = azul-marinho escuro; 'secundaria' = cinza médio (rótulos, rodapé). */
  cor: 'principal' | 'secundaria'
}

export type Retangulo = { x: number; y: number; w: number; h: number }

export type LinhaLayout = {
  y: number
  altura: number
  ponto: { cx: number; cy: number; raio: number }
  /** Linha fina abaixo desta; nula na última linha (a borda do cartão, ou a linha do total, fecha). */
  separadorY: number | null
  textos: Texto[]
}

export type PaginaLayout = {
  altura: number
  titulo: { textos: Texto[]; barra: Retangulo | null }
  cartao: Retangulo & { raio: number }
  cabecalho: { textos: Texto[]; linhaY: number }
  linhas: LinhaLayout[]
  total?: { y: number; altura: number; linhaY: number; textos: Texto[] }
  rodape?: Texto
}

export type LayoutRelatorio = { largura: number; paginas: PaginaLayout[] }

export type OpcoesLayout = {
  /** Máximo de linhas por imagem (padrão 12). */
  linhasPorPagina?: number
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

const txt = (
  texto: string,
  x: number,
  centroY: number,
  tamanho: number,
  negrito: boolean,
  alinhar: 'esq' | 'dir' = 'esq',
  cor: Texto['cor'] = 'principal',
): Texto => ({ texto, x, y: centroY - (tamanho * ALTURA_LINHA) / 2, h: tamanho * ALTURA_LINHA, tamanho, negrito, alinhar, cor })

/**
 * Posições de tudo que vai em cada imagem (puro; a medida do texto é injetada). Cada parte repete título e
 * cabeçalho; o total (se houver) fica só na última; rodapé "Parte i/N" quando há mais de uma. O desenho
 * (canvas) apenas percorre este resultado. O período do relatório NÃO é desenhado (a referência não o tem;
 * as datas das linhas já o mostram).
 */
export function calcularLayoutRelatorio(
  r: Relatorio,
  largura: number,
  medir: Medir,
  op: OpcoesLayout = {},
): LayoutRelatorio {
  const porPagina = Math.max(1, op.linhasPorPagina ?? LINHAS_POR_IMAGEM)
  const rotuloRodape = op.rotuloRodape ?? ((i, n) => `Parte ${i}/${n}`)
  const xCartaoDir = M.margem + M.cartaoW // 1700
  const cartaoX = M.margem

  // ---- título: "Transações efetuadas" | nome (a barra só existe quando há nome) ----
  const corte = r.titulo.indexOf(SEPARADOR_TITULO)
  const base = corte === -1 ? r.titulo : r.titulo.slice(0, corte)
  const nome = corte === -1 ? '' : r.titulo.slice(corte + SEPARADOR_TITULO.length)
  const altTitulo = M.titulo * ALTURA_LINHA // 90
  const centro1 = M.topoTitulo + M.barraH / 2 // 120
  const textosTitulo: Texto[] = []
  let barra: Retangulo | null = null
  let linhasExtras = 0
  if (nome === '') {
    const ls = quebrarTexto(base, xCartaoDir - M.margem, (s) => medir(s, M.titulo, true), MAX_LINHAS_NOME)
    ls.forEach((l, i) => textosTitulo.push(txt(l, M.margem, centro1 + i * altTitulo, M.titulo, true)))
    linhasExtras = ls.length - 1
  } else {
    textosTitulo.push(txt(base, M.margem, centro1, M.titulo, true))
    const barraX = M.margem + medir(base, M.titulo, true) + M.folgaBarra
    const nomeX = barraX + M.barraW + M.folgaBarra
    const ls = quebrarTexto(nome, xCartaoDir - nomeX, (s) => medir(s, M.titulo, true), MAX_LINHAS_NOME)
    ls.forEach((l, i) => textosTitulo.push(txt(l, nomeX, centro1 + i * altTitulo, M.titulo, true)))
    linhasExtras = ls.length - 1
    barra = { x: barraX, y: M.topoTitulo, w: M.barraW, h: M.barraH + linhasExtras * altTitulo }
  }
  const cartaoY = M.cartaoY + linhasExtras * altTitulo

  // ---- colunas: a anotação ocupa o que sobra entre x 860 e o valor ----
  const valorW = Math.max(
    medir('Valor', M.cabecalho, false),
    ...r.linhas.map((l) => medir(l.valor, M.linha, true)),
    r.total ? medir(r.total, M.linha, true) : 0,
  )
  const anotW = Math.max(M.linha * 6, M.valorX - valorW - M.folgaValor - M.anotX)

  // ---- páginas ----
  const grupos: Relatorio['linhas'][] = []
  for (let i = 0; i < r.linhas.length; i += porPagina) grupos.push(r.linhas.slice(i, i + porPagina))
  if (grupos.length === 0) grupos.push([])
  const n = grupos.length

  const paginas = grupos.map((grupo, pi): PaginaLayout => {
    const linhaCab = cartaoY + M.cabecalhoH
    const cabCentro = cartaoY + 80
    const cabecalho = {
      textos: [
        txt('Data', M.dataLabelX, cabCentro, M.cabecalho, false, 'esq', 'secundaria'),
        txt('Anotações', M.anotX, cabCentro, M.cabecalho, false, 'esq', 'secundaria'),
        txt('Valor', M.valorX, cabCentro, M.cabecalho, false, 'dir', 'secundaria'),
      ],
      linhaY: linhaCab,
    }

    const linhas = grupo.map((l, i): LinhaLayout => {
      const y = linhaCab + i * M.linhaH
      const centro = y + M.linhaH / 2
      const textos: Texto[] = [txt(l.data, M.dataX, centro, M.linha, false)]
      if (l.anotacao.trim() !== '') {
        const ls = quebrarTexto(l.anotacao, anotW, (s) => medir(s, M.anotacao, false), MAX_LINHAS_ANOTACAO)
        const passo = M.anotacao * ALTURA_LINHA
        const topo = centro - (ls.length * passo) / 2
        ls.forEach((a, k) => textos.push(txt(a, M.anotX, topo + k * passo + passo / 2, M.anotacao, false)))
      }
      textos.push(txt(l.valor, M.valorX, centro, M.linha, true, 'dir'))
      const ultima = i === grupo.length - 1
      return {
        y,
        altura: M.linhaH,
        ponto: { cx: M.pontoX, cy: centro, raio: M.pontoRaio },
        separadorY: ultima ? null : y + M.linhaH,
        textos,
      }
    })

    let fim = linhaCab + grupo.length * M.linhaH
    let total: PaginaLayout['total']
    if (r.total && pi === n - 1) {
      total = {
        y: fim,
        altura: M.totalH,
        linhaY: fim,
        textos: [
          txt('Total', M.dataLabelX, fim + M.totalH / 2, M.linha, true),
          txt(r.total, M.valorX, fim + M.totalH / 2, M.linha, true, 'dir'),
        ],
      }
      fim += M.totalH
    }

    const cartao = { x: cartaoX, y: cartaoY, w: M.cartaoW, h: fim - cartaoY, raio: M.raio }
    const rodape =
      n > 1
        ? txt(rotuloRodape(pi + 1, n), xCartaoDir, fim + 28 + (M.rodape * ALTURA_LINHA) / 2, M.rodape, false, 'dir', 'secundaria')
        : undefined
    return {
      altura: fim + M.margem,
      titulo: { textos: textosTitulo, barra },
      cartao,
      cabecalho,
      linhas,
      total,
      rodape,
    }
  })

  return { largura, paginas }
}
