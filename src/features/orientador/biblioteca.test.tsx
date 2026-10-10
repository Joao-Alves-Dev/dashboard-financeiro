import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AVISO_EDUCATIVO, IDS_DICAS, TEMAS, carregarBiblioteca, obterDica } from './biblioteca'
import { cfg, ctx } from './fabrica-teste'
import { renderizarCorpo, textoPuro } from './renderizar-corpo'
import { REGRAS, REGRAS_IDS } from './regras'
import { TextoDica } from './texto-dica'

const IDS_SPEC = [
  'orcamento-50-30-20',
  'orcamento-realista',
  'cortar-gastos',
  'revisar-habitos',
  'reserva-emergencia',
  'onde-guardar',
  'metas-ritmo',
  'juros-cartao',
  'quitar-dividas',
  'juros-compostos',
  'renda-fixa-basico',
  'fgc',
  'renda-variavel-risco',
]

/** Taxas e valores que envelhecem (convenção em renderizar-corpo.ts: dinheiro só em blocos de exemplo `> `). */
const PADROES_TAXA = [
  /\d+([.,]\d+)?\s*%\s*(ao|a\.)\s*(ano|mês|mes|dia|a\.a|a\.m)/i,
  /\d+([.,]\d+)?\s*%\s*(do|da)\s*CDI/i,
  /selic[^.\n]{0,40}\d+([.,]\d+)?\s*%/i,
  /(rentabilidade|ganho|lucro|retorno)\s+garantid/i,
  /sem\s+risco/i,
]
const DINHEIRO = /R\$\s*\d/

function palavras(corpo: string): number {
  return renderizarCorpo(corpo)
    .map((b) => {
      if (b.tipo === 'paragrafo') return textoPuro(b.trechos)
      if (b.tipo === 'subtitulo') return b.texto
      if (b.tipo === 'lista') return b.itens.map(textoPuro).join(' ')
      return b.linhas.map(textoPuro).join(' ')
    })
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
}

describe('biblioteca Aprenda', () => {
  const dicas = carregarBiblioteca()

  it('os 13 ids do spec existem e são únicos', () => {
    const ids = dicas.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...IDS_SPEC].sort())
    expect([...IDS_DICAS].sort()).toEqual([...IDS_SPEC].sort())
  })

  it('todo dicaId usado pelas regras existe (e o contexto de teste exercita todas as regras)', () => {
    const cheio = ctx({
      diaDoMes: 15,
      diasNoMes: 30,
      rendaMes: 500_000,
      saidasMes: 400_000,
      categorias: [{ id: 'c', nome: 'Lazer', gastoMes: 200_000, mediaTresMeses: 50_000 }],
      orcamentos: [
        { categoriaId: 'a', nome: 'A', orcado: 100, realizado: 85 },
        { categoriaId: 'b', nome: 'B', orcado: 100, realizado: 100 },
      ],
      metas: [{ id: 'm', nome: 'Viagem', situacao: 'atrasada', necessarioPorMes: 2, sobraMedia: 1 }],
      gastoCartaoMes: 400_000,
      resultadosTresMeses: [1, 2, 3],
    })
    const alertas = REGRAS.flatMap((r) => r(cheio, cfg()))
    expect([...new Set(alertas.map((a) => a.regraId))].sort()).toEqual([...REGRAS_IDS].sort())
    for (const a of alertas) expect(obterDica(a.dicaId), `dica ${a.dicaId} (${a.regraId})`).toBeDefined()
  })

  it('metadados válidos: tema no conjunto, título e resumo preenchidos, títulos distintos', () => {
    for (const d of dicas) {
      expect(TEMAS, d.id).toContain(d.tema)
      expect(d.titulo.trim().length, d.id).toBeGreaterThan(3)
      expect(d.resumo.trim().length, d.id).toBeGreaterThan(20)
      expect(d.resumo.length, d.id).toBeLessThanOrEqual(220)
    }
    expect(new Set(dicas.map((d) => d.titulo)).size).toBe(dicas.length)
  })

  it('cada texto tem de 150 a 400 palavras', () => {
    for (const d of dicas) {
      const n = palavras(d.corpo)
      expect(n, `${d.id} tem ${n} palavras`).toBeGreaterThanOrEqual(150)
      expect(n, `${d.id} tem ${n} palavras`).toBeLessThanOrEqual(400)
    }
  })

  it('nenhuma taxa/valor que envelhece nem promessa de retorno', () => {
    for (const d of dicas) {
      const tudo = d.titulo + '\n' + d.resumo + '\n' + d.corpo
      for (const re of PADROES_TAXA) expect(re.test(tudo), `${d.id} casa ${re}`).toBe(false)
    }
  })

  it('valores em reais só aparecem em blocos de exemplo ("> "); título e resumo nunca', () => {
    for (const d of dicas) {
      expect(DINHEIRO.test(d.titulo + d.resumo), d.id).toBe(false)
      for (const b of renderizarCorpo(d.corpo)) {
        if (b.tipo === 'exemplo') continue
        const t =
          b.tipo === 'paragrafo' ? textoPuro(b.trechos) : b.tipo === 'subtitulo' ? b.texto : b.itens.map(textoPuro).join(' ')
        expect(DINHEIRO.test(t), `${d.id}: "${t.slice(0, 60)}"`).toBe(false)
      }
    }
  })

  it('obterDica devolve a dica pelo id e undefined para id desconhecido', () => {
    expect(obterDica('fgc')?.id).toBe('fgc')
    expect(obterDica('nao-existe')).toBeUndefined()
    expect(obterDica('')).toBeUndefined()
  })

  it('o aviso fixo aparece na renderização de TODA dica', () => {
    expect(AVISO_EDUCATIVO).toBe('Conteúdo educativo; não é recomendação de investimento.')
    for (const d of dicas) {
      const html = renderToStaticMarkup(createElement(TextoDica, { dica: d }))
      expect(html, d.id).toContain(AVISO_EDUCATIVO)
      expect(html, d.id).toContain(d.titulo)
    }
  })

  it('blocos de exemplo saem rotulados como fictícios', () => {
    const comExemplo = dicas.filter((d) => renderizarCorpo(d.corpo).some((b) => b.tipo === 'exemplo'))
    expect(comExemplo.length).toBeGreaterThan(0)
    for (const d of comExemplo) {
      expect(renderToStaticMarkup(createElement(TextoDica, { dica: d })), d.id).toContain('fictícios')
    }
  })
})
