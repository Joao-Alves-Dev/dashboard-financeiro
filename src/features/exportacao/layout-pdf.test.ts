import { describe, expect, it } from 'vitest'
import { calcularLayoutPdf, LINHAS_POR_PAGINA_PDF_PADRAO, TAMANHOS_PADRAO } from './layout-pdf'
import type { Medir } from './layout-relatorio'
import type { Relatorio } from './relatorio'

// Layout A4 (PDF), anterior à Task 15d. Largura de teste: a da antiga imagem de 1080px.
const LARGURA = 1080

// Medida fictícia: cada caractere ocupa metade do tamanho da fonte.
const medir: Medir = (texto, tamanho) => texto.length * tamanho * 0.5

const linhas = (n: number, anotacao = 'Viagem') =>
  Array.from({ length: n }, (_, i) => ({
    data: `${String((i % 28) + 1).padStart(2, '0')}/09/2026`,
    anotacao,
    valor: 'R$ 300,00',
  }))

const rel = (n: number, extra: Partial<Relatorio> = {}, anotacao?: string): Relatorio => ({
  titulo: 'Transações efetuadas | Jerônimo',
  periodo: '12/03/2026 a 26/03/2026',
  linhas: linhas(n, anotacao),
  ...extra,
})

describe('calcularLayoutPdf', () => {
  it('3 linhas: uma página, sem total e sem rodapé, tudo dentro das margens', () => {
    const l = calcularLayoutPdf(rel(3), LARGURA, medir)
    expect(l.paginas).toHaveLength(1)
    const p = l.paginas[0]
    expect(p.total).toBeUndefined()
    expect(p.rodape).toBeUndefined()
    expect(p.linhas).toHaveLength(3)
    const todos = [...p.titulo, p.periodo, ...p.cabecalho.textos, ...p.linhas.flatMap((x) => x.textos)]
    for (const t of todos) {
      const w = medir(t.texto, t.tamanho, t.negrito)
      const ini = t.alinhar === 'dir' ? t.x - w : t.x
      expect(ini).toBeGreaterThanOrEqual(TAMANHOS_PADRAO.margem - 0.001)
      expect(ini + w).toBeLessThanOrEqual(LARGURA - TAMANHOS_PADRAO.margem + 0.001)
    }
    expect(p.altura).toBeGreaterThan(p.linhas[2].y + p.linhas[2].altura)
  })

  it('tamanhos mínimos: título >= 48, linhas >= 36, linhas altas e valor em negrito à direita', () => {
    const p = calcularLayoutPdf(rel(2), LARGURA, medir).paginas[0]
    expect(p.titulo[0].tamanho).toBeGreaterThanOrEqual(48)
    expect(p.titulo[0].negrito).toBe(true)
    for (const linha of p.linhas) {
      expect(linha.altura).toBeGreaterThanOrEqual(36)
      const [data, anot, valor] = linha.textos
      expect(data.tamanho).toBeGreaterThanOrEqual(36)
      expect(anot.tamanho).toBeGreaterThanOrEqual(36)
      expect(valor.negrito).toBe(true)
      expect(valor.alinhar).toBe('dir')
      expect(valor.x).toBe(LARGURA - TAMANHOS_PADRAO.margem)
    }
  })

  it('colunas Data | Anotações | Valor, nesta ordem, no cabeçalho', () => {
    const p = calcularLayoutPdf(rel(1), LARGURA, medir).paginas[0]
    expect(p.cabecalho.textos.map((t) => t.texto)).toEqual(['Data', 'Anotações', 'Valor'])
    const xs = p.cabecalho.textos.map((t) => t.x)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
  })

  it('zebra alterna e as linhas descem sem se sobrepor', () => {
    const p = calcularLayoutPdf(rel(4), LARGURA, medir).paginas[0]
    expect(p.linhas.map((x) => x.zebra)).toEqual([false, true, false, true])
    for (let i = 1; i < p.linhas.length; i++) {
      expect(p.linhas[i].y).toBeGreaterThanOrEqual(p.linhas[i - 1].y + p.linhas[i - 1].altura)
    }
  })

  it('60 linhas: três imagens (25, 25, 10), rodapé "Parte i/N" e total só na última', () => {
    const l = calcularLayoutPdf(rel(60, { total: 'R$ 18.000,00' }), LARGURA, medir)
    expect(LINHAS_POR_PAGINA_PDF_PADRAO).toBe(25)
    expect(l.paginas.map((p) => p.linhas.length)).toEqual([25, 25, 10])
    expect(l.paginas.map((p) => p.rodape?.texto)).toEqual(['Parte 1/3', 'Parte 2/3', 'Parte 3/3'])
    expect(l.paginas.map((p) => p.total !== undefined)).toEqual([false, false, true])
    expect(l.paginas[2].total?.textos.map((t) => t.texto)).toEqual(['Total', 'R$ 18.000,00'])
    // Cada parte repete título e cabeçalho (vai sozinha no WhatsApp).
    expect(l.paginas.every((p) => p.titulo[0].texto === 'Transações efetuadas | Jerônimo')).toBe(true)
  })

  it('25 linhas cabem em uma imagem; 26 viram duas', () => {
    expect(calcularLayoutPdf(rel(25), LARGURA, medir).paginas).toHaveLength(1)
    expect(calcularLayoutPdf(rel(26), LARGURA, medir).paginas).toHaveLength(2)
  })

  it('anotação longa ocupa até duas linhas, com reticências, e a linha fica mais alta', () => {
    const longa = 'Pagamento referente ao financiamento da van Renault parcela de outubro e mais um pouco de texto'
    const curto = calcularLayoutPdf(rel(1), LARGURA, medir).paginas[0].linhas[0]
    const alto = calcularLayoutPdf(rel(1, {}, longa), LARGURA, medir).paginas[0].linhas[0]
    const anotacoes = alto.textos.filter((t) => t.texto !== '' && t.x > TAMANHOS_PADRAO.margem && t.alinhar === 'esq')
    expect(anotacoes).toHaveLength(2)
    expect(anotacoes[1].texto.endsWith('…')).toBe(true)
    expect(alto.altura).toBeGreaterThan(curto.altura)
  })

  it('título comprido quebra em linhas (sem ultrapassar a largura)', () => {
    const r = rel(1, { titulo: 'Transações efetuadas | José Carlos Pereira de Albuquerque Cavalcanti Filho' })
    const p = calcularLayoutPdf(r, LARGURA, medir).paginas[0]
    expect(p.titulo.length).toBeGreaterThan(1)
  })

  it('sem linhas: uma página só com título e cabeçalho', () => {
    const p = calcularLayoutPdf(rel(0), LARGURA, medir).paginas
    expect(p).toHaveLength(1)
    expect(p[0].linhas).toEqual([])
  })

  it('altura máxima (PDF): empacota menos linhas por página e põe o total na última', () => {
    const livre = calcularLayoutPdf(rel(40), LARGURA, medir, { linhasPorPagina: 1000 })
    expect(livre.paginas).toHaveLength(1)
    const alt = calcularLayoutPdf(rel(40, { total: 'R$ 1,00' }), LARGURA, medir, {
      linhasPorPagina: 1000,
      alturaMaxima: 1500,
    })
    expect(alt.paginas.length).toBeGreaterThan(1)
    expect(alt.paginas.every((p) => p.altura <= 1500 + 0.001)).toBe(true)
    expect(alt.paginas.flatMap((p) => p.linhas)).toHaveLength(40)
    expect(alt.paginas.at(-1)?.total).toBeDefined()
    expect(alt.paginas.slice(0, -1).every((p) => p.total === undefined)).toBe(true)
  })
})
