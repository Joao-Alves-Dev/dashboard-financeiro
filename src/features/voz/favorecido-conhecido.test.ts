import { describe, expect, it } from 'vitest'
import { resolverFavorecidoConhecido } from './favorecido-conhecido'
import { interpretarFala } from './interpretar-fala'
import { interpretarComando } from './interpretar-comando'

const HOJE = '2026-10-15'
const JEOVA = { chave: 'jeova', nome: 'Jeová' }
const opcoes = (...favorecidosConhecidos: { chave: string; nome: string }[]) => ({ favorecidosConhecidos })

function fala(texto: string, ...conhecidos: { chave: string; nome: string }[]) {
  const r = interpretarFala(texto, HOJE, opcoes(...conhecidos))
  if (!r.ok) throw new Error(`esperava ok para ${JSON.stringify(texto)}`)
  return r
}

describe('resolverFavorecidoConhecido', () => {
  it('trunca no conhecido quando o resto começa com conector', () => {
    expect(resolverFavorecidoConhecido('Jeová de Viagem', [JEOVA])).toBe('Jeová')
    expect(resolverFavorecidoConhecido('Jeová Referente a Frete', [JEOVA])).toBe('Jeová')
  })

  it('mantém o candidato quando a primeira palavra sobrando não é conector', () => {
    expect(resolverFavorecidoConhecido('Jeová Silva', [JEOVA])).toBe('Jeová Silva')
  })

  it('o conhecido de mais palavras vence', () => {
    const lista = [JEOVA, { chave: 'jeova silva', nome: 'Jeová Silva' }]
    expect(resolverFavorecidoConhecido('Jeová Silva de Viagem', lista)).toBe('Jeová Silva')
    expect(resolverFavorecidoConhecido('Jeová de Viagem', lista)).toBe('Jeová')
  })

  it('candidato igual ao conhecido devolve a grafia do conhecido (acento e caixa)', () => {
    expect(resolverFavorecidoConhecido('jeova', [JEOVA])).toBe('Jeová')
    expect(resolverFavorecidoConhecido('JEOVÁ', [JEOVA])).toBe('Jeová')
    expect(resolverFavorecidoConhecido('João da Silva', [{ chave: 'joao da silva', nome: 'João da Silva' }])).toBe(
      'João da Silva',
    )
  })

  it('compara por chave: acentos e maiúsculas do candidato não importam', () => {
    expect(resolverFavorecidoConhecido('JEOVA De Viagem', [JEOVA])).toBe('Jeová')
  })

  it('candidato com tratamento é comparado sem ele', () => {
    expect(resolverFavorecidoConhecido('Senhor Jeová de Viagem', [JEOVA])).toBe('Jeová')
    expect(resolverFavorecidoConhecido('Dona Maria de Lourdes', [{ chave: 'maria', nome: 'Maria' }])).toBe('Maria')
    expect(resolverFavorecidoConhecido('Seu Jeová', [JEOVA])).toBe('Jeová')
  })

  it('a grafia devolvida é exatamente o nome do conhecido', () => {
    expect(resolverFavorecidoConhecido('Jeová de Viagem', [{ chave: 'jeova', nome: 'senhor Jeova' }])).toBe('senhor Jeova')
  })

  it('conectores diferentes truncam', () => {
    for (const c of ['do', 'da', 'das', 'dos', 'em', 'no', 'na', 'com', 'por', 'pra', 'para', 'pro', 'pelo', 'ao', 'sobre', 'ref']) {
      expect(resolverFavorecidoConhecido(`Jeová ${c} Algo`, [JEOVA])).toBe('Jeová')
    }
  })

  it('conhecido que não é prefixo, ou é prefixo parcial de palavra, não vale', () => {
    expect(resolverFavorecidoConhecido('Maria de Lourdes', [JEOVA])).toBe('Maria de Lourdes')
    expect(resolverFavorecidoConhecido('Jeovane de Viagem', [JEOVA])).toBe('Jeovane de Viagem')
    expect(resolverFavorecidoConhecido('Silva Jeová', [JEOVA])).toBe('Silva Jeová')
  })

  it('conhecido de uma palavra x candidato de uma palavra idêntica', () => {
    expect(resolverFavorecidoConhecido('Maria', [{ chave: 'maria', nome: 'Maria' }])).toBe('Maria')
    // Conhecido mais longo que o candidato não é prefixo.
    expect(resolverFavorecidoConhecido('Maria', [{ chave: 'maria lourdes', nome: 'Maria Lourdes' }])).toBe('Maria')
  })

  it('sem conhecidos, devolve o candidato', () => {
    expect(resolverFavorecidoConhecido('Jeová de Viagem', [])).toBe('Jeová de Viagem')
  })
})

describe('interpretarFala com favorecidosConhecidos', () => {
  it('trunca o favorecido e preserva a descrição', () => {
    const texto = 'paguei 100 reais para o senhor jeová de viagem'
    const com = fala(texto, JEOVA)
    const sem = interpretarFala(texto, HOJE)
    if (!sem.ok) throw new Error('esperava ok')
    expect(com.favorecido).toBe('Jeová')
    expect(sem.favorecido).toBe('Jeová de Viagem')
    expect(com.descricao).toBe(sem.descricao)
  })

  it('"referente a" e entrada', () => {
    expect(fala('paguei 50 reais para o jeova referente a frete', JEOVA).favorecido).toBe('Jeová')
    const r = fala('recebi 100 reais do jeová de viagem', JEOVA)
    expect(r.favorecido).toBe('Jeová')
    expect(r.valorCentavos).toBe(10000)
  })

  it('frase da conversa de referência não muda', () => {
    expect(fala('dia 29 de setembro paguei 100 reais para o senhor jeová', JEOVA)).toEqual({
      ok: true,
      valorCentavos: -10000,
      descricao: 'Para o senhor jeová',
      data: '2026-09-29',
      favorecido: 'Jeová',
    })
  })

  it('nome diferente do conhecido mantém o comportamento atual', () => {
    expect(fala('paguei 100 reais para jeová silva', JEOVA).favorecido).toBe('Jeová Silva')
    expect(fala('paguei 100 reais para dona maria de lourdes', JEOVA).favorecido).toBe('Maria de Lourdes')
  })

  it('o conhecido mais longo vence', () => {
    const r = fala('paguei 100 reais para o senhor jeová silva de viagem', JEOVA, { chave: 'jeova silva', nome: 'Jeová Silva' })
    expect(r.favorecido).toBe('Jeová Silva')
  })

  it('sem favorecido na fala não inventa', () => {
    expect(fala('200 reais de gasolina', JEOVA).favorecido).toBeUndefined()
  })

  it('lista vazia ou ausente é idêntica ao atual', () => {
    const texto = 'paguei 100 reais para o senhor jeová de viagem'
    expect(interpretarFala(texto, HOJE, { favorecidosConhecidos: [] })).toEqual(interpretarFala(texto, HOJE))
    expect(interpretarFala(texto, HOJE, {})).toEqual(interpretarFala(texto, HOJE))
  })
})

describe('interpretarComando com favorecidosConhecidos', () => {
  const H = '2026-10-08'

  it('trunca o favorecido da exportação', () => {
    expect(interpretarComando('exporte as transações para o senhor jeová de viagem deste mês', H, opcoes(JEOVA))).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Jeová',
    })
  })

  it('exportar_incompleto também usa a grafia do conhecido', () => {
    expect(interpretarComando('exporte para jeova', H, opcoes(JEOVA))).toMatchObject({
      tipo: 'exportar_incompleto',
      favorecido: 'Jeová',
    })
  })

  it('nome novo segue como antes', () => {
    const t = 'exporte para dona maria de lourdes deste mês'
    expect(interpretarComando(t, H, opcoes(JEOVA))).toEqual(interpretarComando(t, H))
  })

  it('sem o parâmetro, inalterado', () => {
    expect(interpretarComando('exporte para jeová deste mês', H)).toMatchObject({ favorecido: 'Jeová' })
  })
})
