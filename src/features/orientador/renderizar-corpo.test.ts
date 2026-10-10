import { describe, expect, it } from 'vitest'
import { renderizarCorpo, textoPuro } from './renderizar-corpo'

const t = (texto: string, negrito = false) => ({ texto, negrito })

describe('renderizarCorpo', () => {
  it('parágrafos separados por linha em branco; linhas seguidas viram um parágrafo só', () => {
    expect(renderizarCorpo('Primeira linha\ncontinua aqui.\n\nSegundo parágrafo.')).toEqual([
      { tipo: 'paragrafo', trechos: [t('Primeira linha continua aqui.')] },
      { tipo: 'paragrafo', trechos: [t('Segundo parágrafo.')] },
    ])
  })

  it('subtítulo com ##', () => {
    expect(renderizarCorpo('## Como fazer\n\nTexto.')).toEqual([
      { tipo: 'subtitulo', texto: 'Como fazer' },
      { tipo: 'paragrafo', trechos: [t('Texto.')] },
    ])
  })

  it('lista com - agrupa itens consecutivos', () => {
    expect(renderizarCorpo('- um\n- dois\n- três')).toEqual([
      { tipo: 'lista', itens: [[t('um')], [t('dois')], [t('três')]] },
    ])
  })

  it('negrito com ** em parágrafos e itens', () => {
    expect(renderizarCorpo('Isso é **importante** de verdade.\n\n- **Item** com negrito')).toEqual([
      { tipo: 'paragrafo', trechos: [t('Isso é '), t('importante', true), t(' de verdade.')] },
      { tipo: 'lista', itens: [[t('Item', true), t(' com negrito')]] },
    ])
  })

  it('** sem fechamento fica como texto literal', () => {
    expect(renderizarCorpo('Aberto **sem fechar')).toEqual([{ tipo: 'paragrafo', trechos: [t('Aberto **sem fechar')] }])
  })

  it('linhas com > formam um bloco de exemplo (uma entrada por linha)', () => {
    expect(renderizarCorpo('Antes.\n\n> Linha um **fictícia**\n> Linha dois\n\nDepois.')).toEqual([
      { tipo: 'paragrafo', trechos: [t('Antes.')] },
      { tipo: 'exemplo', linhas: [[t('Linha um '), t('fictícia', true)], [t('Linha dois')]] },
      { tipo: 'paragrafo', trechos: [t('Depois.')] },
    ])
  })

  it('blocos diferentes sem linha em branco entre eles continuam separados', () => {
    expect(renderizarCorpo('Texto\n- item\n## Título')).toEqual([
      { tipo: 'paragrafo', trechos: [t('Texto')] },
      { tipo: 'lista', itens: [[t('item')]] },
      { tipo: 'subtitulo', texto: 'Título' },
    ])
  })

  it('texto vazio e espaços -> []; quebras CRLF são aceitas', () => {
    expect(renderizarCorpo('  \n\n ')).toEqual([])
    expect(renderizarCorpo('A\r\n\r\nB')).toHaveLength(2)
  })

  it('não interpreta HTML: o texto sai literal', () => {
    expect(renderizarCorpo('<script>x</script>')).toEqual([{ tipo: 'paragrafo', trechos: [t('<script>x</script>')] }])
  })
})

describe('textoPuro', () => {
  it('junta os trechos sem a marcação', () => {
    expect(textoPuro([t('a '), t('b', true)])).toBe('a b')
  })
})
