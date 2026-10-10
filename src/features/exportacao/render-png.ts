import {
  calcularLayoutRelatorio,
  LARGURA_PNG,
  TAMANHOS_PNG,
  type PaginaLayout,
  type Texto,
} from './layout-relatorio'
import type { Relatorio } from './relatorio'

/** Fonte do sistema com alternativas: nada é baixado e acentos sempre existem. */
export const FONTE_CANVAS = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif'

// Cores com contraste mínimo de 7:1 sobre o fundo branco (e sobre a zebra).
const COR_PRINCIPAL = '#111111'
const COR_SECUNDARIA = '#3f3f46'
const COR_ZEBRA = '#f1f1f5'
const COR_SEPARADOR = '#cfcfd8'

const fonte = (tamanho: number, negrito: boolean) => `${negrito ? 700 : 400} ${tamanho}px ${FONTE_CANVAS}`

function desenharTexto(ctx: CanvasRenderingContext2D, t: Texto) {
  if (t.texto === '') return
  ctx.font = fonte(t.tamanho, t.negrito)
  ctx.fillStyle = t.cor === 'principal' ? COR_PRINCIPAL : COR_SECUNDARIA
  ctx.textAlign = t.alinhar === 'dir' ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(t.texto, t.x, t.y + t.h / 2)
}

function linha(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number, espessura: number, cor: string) {
  ctx.fillStyle = cor
  ctx.fillRect(x0, y - espessura / 2, x1 - x0, espessura)
}

function desenharPagina(ctx: CanvasRenderingContext2D, p: PaginaLayout, largura: number, margem: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, p.altura)
  const x0 = margem - 20
  const x1 = largura - margem + 20

  for (const t of p.titulo) desenharTexto(ctx, t)
  desenharTexto(ctx, p.periodo)

  for (const t of p.cabecalho.textos) desenharTexto(ctx, t)
  linha(ctx, p.cabecalho.linhaY, margem, largura - margem, 4, COR_PRINCIPAL)

  for (const l of p.linhas) {
    if (l.zebra) {
      ctx.fillStyle = COR_ZEBRA
      ctx.fillRect(x0, l.y, x1 - x0, l.altura)
    }
    for (const t of l.textos) desenharTexto(ctx, t)
    linha(ctx, l.separadorY, margem, largura - margem, 2, COR_SEPARADOR)
  }

  if (p.total) {
    linha(ctx, p.total.linhaY, margem, largura - margem, 4, COR_PRINCIPAL)
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
 * Desenha a lista em PNG no navegador (nada vai ao servidor): 1080px de largura, letras grandes,
 * até 25 linhas por imagem; mais que isso gera várias imagens com rodapé "Parte i/N".
 */
export async function renderizarPng(r: Relatorio, largura: number = LARGURA_PNG): Promise<Blob[]> {
  const medidor = document.createElement('canvas').getContext('2d')
  if (!medidor) throw new Error('canvas')
  const layout = calcularLayoutRelatorio(
    r,
    largura,
    (texto, tamanho, negrito) => {
      medidor.font = fonte(tamanho, negrito)
      return medidor.measureText(texto).width
    },
    { tamanhos: TAMANHOS_PNG },
  )

  const blobs: Blob[] = []
  for (const p of layout.paginas) {
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = Math.ceil(p.altura)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    desenharPagina(ctx, p, largura, layout.margem)
    blobs.push(await paraBlob(canvas))
  }
  return blobs
}
