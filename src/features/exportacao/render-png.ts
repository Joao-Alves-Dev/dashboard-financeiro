import { calcularLayoutRelatorio, FONTE_PNG, LARGURA_PNG, type PaginaLayout, type Texto } from './layout-relatorio'
import type { Relatorio } from './relatorio'

// Cores da imagem de referência.
const COR_FUNDO = '#f4f5f7'
const COR_CARTAO = '#ffffff'
const COR_BORDA = '#e5e7eb'
const COR_PRINCIPAL = '#1f2937'
const COR_SECUNDARIA = '#6b7280'
const COR_PONTO = '#2f5597'
const COR_SEPARADOR = '#e5e7eb'

const fonte = (tamanho: number, negrito: boolean) => `${negrito ? 700 : 400} ${tamanho}px ${FONTE_PNG}`

function desenharTexto(ctx: CanvasRenderingContext2D, t: Texto) {
  if (t.texto === '') return
  ctx.font = fonte(t.tamanho, t.negrito)
  ctx.fillStyle = t.cor === 'principal' ? COR_PRINCIPAL : COR_SECUNDARIA
  ctx.textAlign = t.alinhar === 'dir' ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(t.texto, t.x, t.y + t.h / 2)
}

function cartaoArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function linhaFina(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, espessura: number, cor: string) {
  ctx.fillStyle = cor
  ctx.fillRect(x0, y - espessura / 2, x1 - x0, espessura)
}

function desenharPagina(ctx: CanvasRenderingContext2D, p: PaginaLayout, largura: number) {
  ctx.fillStyle = COR_FUNDO
  ctx.fillRect(0, 0, largura, p.altura)

  // título + barra vertical + nome
  for (const t of p.titulo.textos) desenharTexto(ctx, t)
  if (p.titulo.barra) {
    ctx.fillStyle = COR_PRINCIPAL
    ctx.fillRect(p.titulo.barra.x, p.titulo.barra.y, p.titulo.barra.w, p.titulo.barra.h)
  }

  // cartão branco de borda fina
  const c = p.cartao
  cartaoArredondado(ctx, c.x, c.y, c.w, c.h, c.raio)
  ctx.fillStyle = COR_CARTAO
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = COR_BORDA
  ctx.stroke()

  // Os separadores vão de x 170 a x 1630 (a coluna de dentro do cartão), como na referência.
  const x0 = c.x + 70
  const x1 = c.x + c.w - 70
  for (const t of p.cabecalho.textos) desenharTexto(ctx, t)
  linhaFina(ctx, p.cabecalho.linhaY, x0, x1, 2, COR_SEPARADOR)

  for (const l of p.linhas) {
    ctx.beginPath()
    ctx.arc(l.ponto.cx, l.ponto.cy, l.ponto.raio, 0, Math.PI * 2)
    ctx.fillStyle = COR_PONTO
    ctx.fill()
    for (const t of l.textos) desenharTexto(ctx, t)
    if (l.separadorY !== null) linhaFina(ctx, l.separadorY, x0, x1, 2, COR_SEPARADOR)
  }

  if (p.total) {
    linhaFina(ctx, p.total.linhaY, x0, x1, 3, COR_PRINCIPAL)
    for (const t of p.total.textos) desenharTexto(ctx, t)
  }
  if (p.rodape) desenharTexto(ctx, p.rodape)
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png')
  })
}

/**
 * Desenha a lista em PNG no navegador (nada vai ao servidor), no layout da imagem de referência: 1800px de
 * largura, cartão branco sobre fundo cinza claro, até 12 linhas por imagem; mais que isso gera várias imagens
 * com título e cabeçalho repetidos e rodapé "Parte i/N".
 */
export async function renderizarPng(r: Relatorio, largura: number = LARGURA_PNG): Promise<Blob[]> {
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('canvas')
  const layout = calcularLayoutRelatorio(r, largura, (texto, tamanho, negrito) => {
    medidor.font = fonte(tamanho, negrito)
    return medidor.measureText(texto).width
  })

  const blobs: Blob[] = []
  for (const p of layout.paginas) {
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = Math.ceil(p.altura)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    desenharPagina(ctx, p, largura)
    blobs.push(await paraBlob(canvas))
  }
  return blobs
}
