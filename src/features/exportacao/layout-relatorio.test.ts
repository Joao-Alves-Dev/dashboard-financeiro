import { describe, expect, it } from 'vitest'
import {
  calcularLayoutRelatorio,
  LARGURA_PNG,
  LINHAS_POR_IMAGEM,
  quebrarTexto,
  type Medir,
  type Texto,
} from './layout-relatorio'
import type { Relatorio } from './relatorio'

// Medida fictícia: cada caractere ocupa metade do tamanho da fonte.
const medir: Medir = (texto, tamanho) => texto.length * tamanho * 0.5

const DATAS = ['29/09/2026', '05/10/2026', '08/10/2026', '09/10/2026']
const linhas = (n: number, anotacao = '') =>
  Array.from({ length: n }, (_, i) => ({
    data: DATAS[i % DATAS.length],
    anotacao,
    valor: i % 3 === 0 ? 'R$ 100,00' : 'R$ 300,00',
  }))

const rel = (n: number, extra: Partial<Relatorio> = {}, anotacao?: string): Relatorio => ({
  titulo: 'Transações efetuadas | Jeová',
  periodo: '29/09/2026 a 09/10/2026',
  linhas: linhas(n, anotacao),
  ...extra,
})

const layout = (r: Relatorio) => calcularLayoutRelatorio(r, LARGURA_PNG, medir)

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

describe('calcularLayoutRelatorio: layout da imagem de referência (1800px)', () => {
  it('constantes: 1800px de largura e 12 linhas por imagem', () => {
    expect(LARGURA_PNG).toBe(1800)
    expect(LINHAS_POR_IMAGEM).toBe(12)
  })

  it('4 linhas: altura 1170; cartão de 100 a 1700, a partir de y 260, raio 40', () => {
    const l = layout(rel(4))
    expect(l.largura).toBe(1800)
    expect(l.paginas).toHaveLength(1)
    const p = l.paginas[0]
    expect(p.altura).toBe(1170)
    expect(p.cartao).toEqual({ x: 100, y: 260, w: 1600, h: 810, raio: 40 })
    // margem inferior de 100 depois do cartão
    expect(p.cartao.y + p.cartao.h + 100).toBe(p.altura)
  })

  it('a altura acompanha o número de linhas: 490 + 170 por linha', () => {
    for (const n of [0, 1, 2, 5, 12]) expect(layout(rel(n)).paginas[0].altura).toBe(490 + 170 * n)
  })

  it('título em 72px negrito à esquerda (x 100), barra de 8x80 e o nome, tudo na mesma linha', () => {
    const p = layout(rel(4)).paginas[0]
    const [base, nome] = p.titulo.textos
    expect(base).toMatchObject({ texto: 'Transações efetuadas', x: 100, tamanho: 72, negrito: true, alinhar: 'esq' })
    expect(p.titulo.barra).not.toBeNull()
    const barra = p.titulo.barra!
    expect(barra).toMatchObject({ y: 80, w: 8, h: 80 })
    // a barra vem depois do texto (folga de 40) e o nome depois da barra (folga de 40)
    expect(barra.x).toBe(100 + medir('Transações efetuadas', 72, true) + 40)
    expect(nome).toMatchObject({ texto: 'Jeová', tamanho: 72, negrito: true })
    expect(nome.x).toBe(barra.x + barra.w + 40)
    // mesma linha: caixas de texto iguais e centradas na barra (y 120)
    expect(nome.y).toBe(base.y)
    expect(base.y + base.h / 2).toBe(120)
    expect(barra.y + barra.h / 2).toBe(120)
  })

  it('cabeçalho: Data (x 170), Anotações (x 860), Valor à direita (x 1630), 28px; linha fina embaixo', () => {
    const p = layout(rel(1)).paginas[0]
    const [data, anot, valor] = p.cabecalho.textos
    expect(data).toMatchObject({ texto: 'Data', x: 170, tamanho: 28, alinhar: 'esq', negrito: false, cor: 'secundaria' })
    expect(anot).toMatchObject({ texto: 'Anotações', x: 860, tamanho: 28, alinhar: 'esq' })
    expect(valor).toMatchObject({ texto: 'Valor', x: 1630, tamanho: 28, alinhar: 'dir' })
    // centro do cabeçalho em y 340 e linha separadora em 390 (130 abaixo do topo do cartão)
    expect(data.y + data.h / 2).toBe(340)
    expect(p.cabecalho.linhaY).toBe(390)
  })

  it('cada linha tem 170px: ponto azul de raio 16 em x 190, data em x 240 (40px), valor em 40px negrito à direita', () => {
    const p = layout(rel(4)).paginas[0]
    expect(p.linhas.map((x) => x.y)).toEqual([390, 560, 730, 900])
    for (const l of p.linhas) {
      expect(l.altura).toBe(170)
      expect(l.ponto).toEqual({ cx: 190, cy: l.y + 85, raio: 16 })
      const data = l.textos.find((t) => t.x === 240)!
      expect(data).toMatchObject({ tamanho: 40, negrito: false, alinhar: 'esq' })
      expect(data.y + data.h / 2).toBe(l.y + 85)
      const valor = l.textos.find((t) => t.alinhar === 'dir')!
      expect(valor).toMatchObject({ x: 1630, tamanho: 40, negrito: true })
      expect(valor.y + valor.h / 2).toBe(l.y + 85)
    }
    expect(p.linhas[0].textos.map((t) => t.texto)).toEqual(['29/09/2026', 'R$ 100,00'])
  })

  it('separadores entre as linhas e nenhum depois da última (sem total); sem zebra', () => {
    const p = layout(rel(4)).paginas[0]
    expect(p.linhas.map((x) => x.separadorY)).toEqual([560, 730, 900, null])
    expect('zebra' in p.linhas[0]).toBe(false)
  })

  it('anotação em branco não desenha texto; com texto, começa em x 860', () => {
    const vazio = layout(rel(1)).paginas[0].linhas[0]
    expect(vazio.textos.some((t) => t.x === 860)).toBe(false)
    const com = layout(rel(1, {}, 'Viagem')).paginas[0].linhas[0]
    const anot = com.textos.filter((t) => t.x === 860)
    expect(anot).toHaveLength(1)
    expect(anot[0]).toMatchObject({ texto: 'Viagem', alinhar: 'esq', negrito: false })
    expect(anot[0].y + anot[0].h / 2).toBe(com.y + 85)
  })

  it('anotação longa: até 2 linhas, com reticências, dentro da coluna (sem tocar o valor)', () => {
    const longa = 'Pagamento referente ao financiamento da van parcela de outubro e mais um pouco de texto aqui'
    const l = layout(rel(1, {}, longa)).paginas[0].linhas[0]
    const anot = l.textos.filter((t) => t.x === 860)
    expect(anot).toHaveLength(2)
    expect(anot[1].texto.endsWith('…')).toBe(true)
    const valor = l.textos.find((t) => t.alinhar === 'dir')!
    const valorEsq = valor.x - medir(valor.texto, valor.tamanho, valor.negrito)
    for (const a of anot) expect(860 + medir(a.texto, a.tamanho, a.negrito)).toBeLessThan(valorEsq)
    // as duas linhas cabem dentro dos 170px da linha
    expect(anot[0].y).toBeGreaterThanOrEqual(l.y)
    expect(anot[1].y + anot[1].h).toBeLessThanOrEqual(l.y + l.altura)
  })

  it('tudo dentro das margens do cartão (x de 100 a 1700)', () => {
    const p = layout(rel(5, {}, 'Viagem a trabalho')).paginas[0]
    const todos: Texto[] = [...p.titulo.textos, ...p.cabecalho.textos, ...p.linhas.flatMap((x) => x.textos)]
    for (const t of todos) {
      const w = medir(t.texto, t.tamanho, t.negrito)
      const ini = t.alinhar === 'dir' ? t.x - w : t.x
      expect(ini).toBeGreaterThanOrEqual(100)
      expect(ini + w).toBeLessThanOrEqual(1700)
    }
  })

  it('12 linhas cabem em uma imagem; 13 viram duas (12 e 1)', () => {
    expect(layout(rel(12)).paginas).toHaveLength(1)
    expect(layout(rel(13)).paginas.map((p) => p.linhas.length)).toEqual([12, 1])
  })

  it('30 linhas: três imagens (12, 12, 6), rodapé "Parte i/N", título e cabeçalho repetidos, total só na última', () => {
    const l = layout(rel(30, { total: 'R$ 9.000,00' }))
    expect(l.paginas.map((p) => p.linhas.length)).toEqual([12, 12, 6])
    expect(l.paginas.map((p) => p.rodape?.texto)).toEqual(['Parte 1/3', 'Parte 2/3', 'Parte 3/3'])
    expect(l.paginas.map((p) => p.total !== undefined)).toEqual([false, false, true])
    expect(l.paginas[2].total?.textos.map((t) => t.texto)).toEqual(['Total', 'R$ 9.000,00'])
    for (const p of l.paginas) {
      expect(p.titulo.textos[0].texto).toBe('Transações efetuadas')
      expect(p.cabecalho.textos.map((t) => t.texto)).toEqual(['Data', 'Anotações', 'Valor'])
      expect(p.cartao.y).toBe(260)
    }
    // o rodapé fica abaixo do cartão, à direita (x 1700), e dentro da imagem
    const p = l.paginas[0]
    expect(p.rodape).toMatchObject({ alinhar: 'dir', x: 1700 })
    expect(p.rodape!.y).toBeGreaterThanOrEqual(p.cartao.y + p.cartao.h)
    expect(p.rodape!.y + p.rodape!.h).toBeLessThanOrEqual(p.altura)
    // uma imagem só: sem rodapé
    expect(layout(rel(4)).paginas[0].rodape).toBeUndefined()
  })

  it('total opcional: linha final em negrito dentro do cartão, separada por uma linha', () => {
    const p = layout(rel(4, { total: 'R$ 800,00' })).paginas[0]
    expect(p.total).toBeDefined()
    expect(p.linhas.at(-1)!.separadorY).toBeNull()
    expect(p.total!.linhaY).toBe(1070) // fim da última linha (390 + 4 x 170)
    const [rotulo, valor] = p.total!.textos
    expect(rotulo).toMatchObject({ texto: 'Total', x: 170, negrito: true, tamanho: 40 })
    expect(valor).toMatchObject({ texto: 'R$ 800,00', x: 1630, negrito: true, alinhar: 'dir' })
    expect(p.cartao.y + p.cartao.h).toBe(1070 + 150)
    expect(p.altura).toBe(1070 + 150 + 100)
  })

  it('nome comprido quebra em até 2 linhas ao lado da barra e o cartão desce', () => {
    const nome = 'José Carlos Pereira de Albuquerque Cavalcanti Filho Neto Segundo Terceiro'
    const p = layout(rel(2, { titulo: `Transações efetuadas | ${nome}` })).paginas[0]
    expect(p.titulo.textos.length).toBe(3) // título + 2 linhas do nome
    expect(p.cartao.y).toBeGreaterThan(260)
    expect(p.altura).toBe(p.cartao.y + p.cartao.h + 100)
    const ultima = p.titulo.textos[2]
    expect(ultima.texto.endsWith('…')).toBe(true)
    expect(p.titulo.barra!.h).toBeGreaterThan(80)
  })

  it('título sem " | " não tem barra', () => {
    const p = layout(rel(1, { titulo: 'Lista de pagamentos' })).paginas[0]
    expect(p.titulo.barra).toBeNull()
    expect(p.titulo.textos[0]).toMatchObject({ texto: 'Lista de pagamentos', x: 100, tamanho: 72 })
  })

  it('sem linhas: uma imagem só com título e cabeçalho', () => {
    const l = layout(rel(0))
    expect(l.paginas).toHaveLength(1)
    expect(l.paginas[0].linhas).toEqual([])
    expect(l.paginas[0].cartao.h).toBe(130)
  })

  it('o período não aparece no PNG (como na referência)', () => {
    const p = layout(rel(2)).paginas[0]
    const textos = [...p.titulo.textos, ...p.cabecalho.textos, ...p.linhas.flatMap((x) => x.textos)].map((t) => t.texto)
    expect(textos.some((t) => t.includes(' a '))).toBe(false)
  })
})
