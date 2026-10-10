import { calcularLayoutRelatorio, type Tamanhos, type Texto } from './layout-relatorio'
import type { Relatorio } from './relatorio'

// A4 retrato em pontos.
const LARGURA_A4 = 595.28
const ALTURA_A4 = 841.89

const TAMANHOS_PDF: Tamanhos = {
  titulo: 22,
  periodo: 13,
  cabecalho: 11,
  linha: 12,
  total: 13,
  rodape: 9,
  margem: 42,
  padLinha: 7,
}

const COR_PRINCIPAL: [number, number, number] = [17, 17, 17]
const COR_SECUNDARIA: [number, number, number] = [63, 63, 70]
const COR_ZEBRA: [number, number, number] = [241, 241, 245]
const COR_SEPARADOR: [number, number, number] = [207, 207, 216]

/**
 * A fonte padrão do jsPDF (Helvetica, WinAnsi) cobre todo o português (ç, ã, õ, é, á, ê, º…).
 * Caracteres fora dela (emoji, escritas não latinas) sairiam trocados por lixo, então viram "?".
 * Nada é transliterado: "Jeová" e "Anotações" saem exatamente assim.
 */
const FORA_DO_WINANSI = /[^ -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu
export function paraPdf(texto: string): string {
  return texto.normalize('NFC').replace(FORA_DO_WINANSI, '?')
}

/** Gera a lista em PDF A4 retrato no navegador (jsPDF carregado só neste momento). */
export async function renderizarPdf(r: Relatorio): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const usarFonte = (tamanho: number, negrito: boolean) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(tamanho)
  }

  const limpo: Relatorio = {
    titulo: paraPdf(r.titulo),
    periodo: paraPdf(r.periodo),
    linhas: r.linhas.map((l) => ({ data: l.data, anotacao: paraPdf(l.anotacao), valor: paraPdf(l.valor) })),
    ...(r.total ? { total: paraPdf(r.total) } : {}),
  }
  const layout = calcularLayoutRelatorio(
    limpo,
    LARGURA_A4,
    (texto, tamanho, negrito) => {
      usarFonte(tamanho, negrito)
      return doc.getTextWidth(texto)
    },
    {
      tamanhos: TAMANHOS_PDF,
      linhasPorPagina: 1000,
      alturaMaxima: ALTURA_A4,
      rotuloRodape: (i, n) => `Página ${i}/${n}`,
    },
  )

  const texto = (t: Texto) => {
    if (t.texto === '') return
    usarFonte(t.tamanho, t.negrito)
    doc.setTextColor(...(t.cor === 'principal' ? COR_PRINCIPAL : COR_SECUNDARIA))
    doc.text(t.texto, t.x, t.y + t.h / 2, { align: t.alinhar === 'dir' ? 'right' : 'left', baseline: 'middle' })
  }
  const traco = (y: number, espessura: number, cor: [number, number, number]) => {
    doc.setDrawColor(...cor)
    doc.setLineWidth(espessura)
    doc.line(layout.margem, y, LARGURA_A4 - layout.margem, y)
  }

  layout.paginas.forEach((p, i) => {
    if (i > 0) doc.addPage('a4', 'portrait')
    p.titulo.forEach(texto)
    texto(p.periodo)
    p.cabecalho.textos.forEach(texto)
    traco(p.cabecalho.linhaY, 1.6, COR_PRINCIPAL)
    for (const l of p.linhas) {
      if (l.zebra) {
        doc.setFillColor(...COR_ZEBRA)
        doc.rect(layout.margem - 8, l.y, LARGURA_A4 - 2 * layout.margem + 16, l.altura, 'F')
      }
      l.textos.forEach(texto)
      traco(l.separadorY, 0.6, COR_SEPARADOR)
    }
    if (p.total) {
      traco(p.total.linhaY, 1.6, COR_PRINCIPAL)
      p.total.textos.forEach(texto)
    }
    if (p.rodape) texto(p.rodape)
  })

  doc.setProperties({ title: limpo.titulo })
  return doc.output('blob')
}
