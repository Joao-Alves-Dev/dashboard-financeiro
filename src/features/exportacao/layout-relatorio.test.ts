import { describe, expect, it } from 'vitest'
import {
  calcularLayoutRelatorio,
  LARGURA_PNG,
  LINHAS_POR_IMAGEM,
  quebrarTexto,
  TAMANHOS_PNG,
  type Medir,
} from './layout-relatorio'
import type { Relatorio } from './relatorio'

// Medida fictícia: cada caractere ocupa metade do tamanho da fonte.
const medir: Medir = (texto, tamanho) => texto.length * tamanho * 0.5

const linhas = (n: number, anotacao = 'Viagem') =>
  Array.from({ length: n }, (_, i) => ({
    data: `${String((i % 28) + 1).padStart(2, '0')}/09/2026`,
    anotacao,
    valor: 'R$ 300,00',
  }))

const rel = (n: number, extra: Partial<Relatorio> = {}, anotacao?: string): Relatorio => ({
  titulo: 'Transações efetuadas | Jeová',
  periodo: '29/09/2026 a 08/10/2026',
  linhas: linhas(n, anotacao),
  ...extra,
})

describe('quebrarTexto', () => {
  const m = (t: string) => t.length * 10
  it('cabe: uma linha; vazio: uma linha vazia', () => {
    expect(quebrarTexto('Viagem', 100, m, 2)).toEqual(['Viagem'])
    expect(quebrarTexto('', 100, m, 2)).toEqual([''])
  })
  it('quebra por palavras', () => {
    expect(quebrarTexto('um dois tres quatro', 90, m, 3)).toEqual(['um dois', 'tres', 'quatro'])
  })
  it('acima do máximo de linhas termina com reticências, sem estourar a largura', () => {
    const l = quebrarTexto('um dois tres quatro cinco seis sete oito', 90, m, 2)
    expect(l).toHaveLength(2)
    expect(l[1].endsWith('…')).toBe(true)
    expect(l.every((x) => m(x) <= 90)).toBe(true)
  })
  it('palavra maior que a linha é cortada por caractere', () => {
    const l = quebrarTexto('abcdefghijklmnopqrstuvwxyz', 100, m, 3)
    expect(l.every((x) => m(x) <= 100)).toBe(true)
    expect(l.join('').replace('…', '')).toContain('abcdefghij')
  })
})

describe('calcularLayoutRelatorio', () => {
  it('3 linhas: uma página, sem total e sem rodapé, tudo dentro das margens', () => {
    const l = calcularLayoutRelatorio(rel(3), LARGURA_PNG, medir)
    expect(l.paginas).toHaveLength(1)
    const p = l.paginas[0]
    expect(p.total).toBeUndefined()
    expect(p.rodape).toBeUndefined()
    expect(p.linhas).toHaveLength(3)
    const todos = [...p.titulo, p.periodo, ...p.cabecalho.textos, ...p.linhas.flatMap((x) => x.textos)]
    for (const t of todos) {
      const w = medir(t.texto, t.tamanho, t.negrito)
      const ini = t.alinhar === 'dir' ? t.x - w : t.x
      expect(ini).toBeGreaterThanOrEqual(TAMANHOS_PNG.margem - 0.001)
      expect(ini + w).toBeLessThanOrEqual(LARGURA_PNG - TAMANHOS_PNG.margem + 0.001)
    }
    expect(p.altura).toBeGreaterThan(p.linhas[2].y + p.linhas[2].altura)
  })

  it('tamanhos mínimos: título >= 48, linhas >= 36, linhas altas e valor em negrito à direita', () => {
    const p = calcularLayoutRelatorio(rel(2), LARGURA_PNG, medir).paginas[0]
    expect(p.titulo[0].tamanho).toBeGreaterThanOrEqual(48)
    expect(p.titulo[0].negrito).toBe(true)
    for (const linha of p.linhas) {
      expect(linha.altura).toBeGreaterThanOrEqual(36)
      const [data, anot, valor] = linha.textos
      expect(data.tamanho).toBeGreaterThanOrEqual(36)
      expect(anot.tamanho).toBeGreaterThanOrEqual(36)
      expect(valor.negrito).toBe(true)
      expect(valor.alinhar).toBe('dir')
      expect(valor.x).toBe(LARGURA_PNG - TAMANHOS_PNG.margem)
    }
  })

  it('colunas Data | Anotações | Valor, nesta ordem, no cabeçalho', () => {
    const p = calcularLayoutRelatorio(rel(1), LARGURA_PNG, medir).paginas[0]
    expect(p.cabecalho.textos.map((t) => t.texto)).toEqual(['Data', 'Anotações', 'Valor'])
    const xs = p.cabecalho.textos.map((t) => t.x)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
  })

  it('zebra alterna e as linhas descem sem se sobrepor', () => {
    const p = calcularLayoutRelatorio(rel(4), LARGURA_PNG, medir).paginas[0]
    expect(p.linhas.map((x) => x.zebra)).toEqual([false, true, false, true])
    for (let i = 1; i < p.linhas.length; i++) {
      expect(p.linhas[i].y).toBeGreaterThanOrEqual(p.linhas[i - 1].y + p.linhas[i - 1].altura)
    }
  })

  it('60 linhas: três imagens (25, 25, 10), rodapé "Parte i/N" e total só na última', () => {
    const l = calcularLayoutRelatorio(rel(60, { total: 'R$ 18.000,00' }), LARGURA_PNG, medir)
    expect(LINHAS_POR_IMAGEM).toBe(25)
    expect(l.paginas.map((p) => p.linhas.length)).toEqual([25, 25, 10])
    expect(l.paginas.map((p) => p.rodape?.texto)).toEqual(['Parte 1/3', 'Parte 2/3', 'Parte 3/3'])
    expect(l.paginas.map((p) => p.total !== undefined)).toEqual([false, false, true])
    expect(l.paginas[2].total?.textos.map((t) => t.texto)).toEqual(['Total', 'R$ 18.000,00'])
    // Cada parte repete título e cabeçalho (vai sozinha no WhatsApp).
    expect(l.paginas.every((p) => p.titulo[0].texto === 'Transações efetuadas | Jeová')).toBe(true)
  })

  it('25 linhas cabem em uma imagem; 26 viram duas', () => {
    expect(calcularLayoutRelatorio(rel(25), LARGURA_PNG, medir).paginas).toHaveLength(1)
    expect(calcularLayoutRelatorio(rel(26), LARGURA_PNG, medir).paginas).toHaveLength(2)
  })

  it('anotação longa ocupa até duas linhas, com reticências, e a linha fica mais alta', () => {
    const longa = 'Pagamento referente ao financiamento da van Renault parcela de outubro e mais um pouco de texto'
    const curto = calcularLayoutRelatorio(rel(1), LARGURA_PNG, medir).paginas[0].linhas[0]
    const alto = calcularLayoutRelatorio(rel(1, {}, longa), LARGURA_PNG, medir).paginas[0].linhas[0]
    const anotacoes = alto.textos.filter((t) => t.texto !== '' && t.x > TAMANHOS_PNG.margem && t.alinhar === 'esq')
    expect(anotacoes).toHaveLength(2)
    expect(anotacoes[1].texto.endsWith('…')).toBe(true)
    expect(alto.altura).toBeGreaterThan(curto.altura)
  })

  it('título comprido quebra em linhas (sem ultrapassar a largura)', () => {
    const r = rel(1, { titulo: 'Transações efetuadas | José Carlos Pereira de Albuquerque Cavalcanti Filho' })
    const p = calcularLayoutRelatorio(r, LARGURA_PNG, medir).paginas[0]
    expect(p.titulo.length).toBeGreaterThan(1)
  })

  it('sem linhas: uma página só com título e cabeçalho', () => {
    const p = calcularLayoutRelatorio(rel(0), LARGURA_PNG, medir).paginas
    expect(p).toHaveLength(1)
    expect(p[0].linhas).toEqual([])
  })

  it('altura máxima (PDF): empacota menos linhas por página e põe o total na última', () => {
    const livre = calcularLayoutRelatorio(rel(40), LARGURA_PNG, medir, { linhasPorPagina: 1000 })
    expect(livre.paginas).toHaveLength(1)
    const alt = calcularLayoutRelatorio(rel(40, { total: 'R$ 1,00' }), LARGURA_PNG, medir, {
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
