import { describe, expect, it } from 'vitest'
import { resolverFavorecidoConhecido } from './favorecido-conhecido'
import { interpretarFala } from './interpretar-fala'
import { interpretarComando } from './interpretar-comando'

const HOJE = '2026-10-15'
const JERONIMO = { chave: 'jeronimo', nome: 'Jerônimo' }
const opcoes = (...favorecidosConhecidos: { chave: string; nome: string }[]) => ({ favorecidosConhecidos })

function fala(texto: string, ...conhecidos: { chave: string; nome: string }[]) {
  const r = interpretarFala(texto, HOJE, opcoes(...conhecidos))
  if (!r.ok) throw new Error(`esperava ok para ${JSON.stringify(texto)}`)
  return r
}

describe('resolverFavorecidoConhecido', () => {
  it('trunca no conhecido quando o resto começa com conector', () => {
    expect(resolverFavorecidoConhecido('Jerônimo de Viagem', [JERONIMO])).toBe('Jerônimo')
    expect(resolverFavorecidoConhecido('Jerônimo Referente a Frete', [JERONIMO])).toBe('Jerônimo')
  })

  it('mantém o candidato quando a primeira palavra sobrando não é conector', () => {
    expect(resolverFavorecidoConhecido('Jerônimo Silva', [JERONIMO])).toBe('Jerônimo Silva')
  })

  it('o conhecido de mais palavras vence', () => {
    const lista = [JERONIMO, { chave: 'jeronimo silva', nome: 'Jerônimo Silva' }]
    expect(resolverFavorecidoConhecido('Jerônimo Silva de Viagem', lista)).toBe('Jerônimo Silva')
    expect(resolverFavorecidoConhecido('Jerônimo de Viagem', lista)).toBe('Jerônimo')
  })

  it('candidato igual ao conhecido devolve a grafia do conhecido (acento e caixa)', () => {
    expect(resolverFavorecidoConhecido('jeronimo', [JERONIMO])).toBe('Jerônimo')
    expect(resolverFavorecidoConhecido('JERÔNIMO', [JERONIMO])).toBe('Jerônimo')
    expect(resolverFavorecidoConhecido('João da Silva', [{ chave: 'joao da silva', nome: 'João da Silva' }])).toBe(
      'João da Silva',
    )
  })

  it('compara por chave: acentos e maiúsculas do candidato não importam', () => {
    expect(resolverFavorecidoConhecido('JERONIMO De Viagem', [JERONIMO])).toBe('Jerônimo')
  })

  it('candidato com tratamento é comparado sem ele', () => {
    expect(resolverFavorecidoConhecido('Senhor Jerônimo de Viagem', [JERONIMO])).toBe('Jerônimo')
    expect(resolverFavorecidoConhecido('Dona Maria de Lourdes', [{ chave: 'maria', nome: 'Maria' }])).toBe('Maria')
    expect(resolverFavorecidoConhecido('Seu Jerônimo', [JERONIMO])).toBe('Jerônimo')
  })

  it('a grafia devolvida é exatamente o nome do conhecido', () => {
    expect(resolverFavorecidoConhecido('Jerônimo de Viagem', [{ chave: 'jeronimo', nome: 'senhor Jeronimo' }])).toBe('senhor Jeronimo')
  })

  it('conectores diferentes truncam', () => {
    for (const c of ['do', 'da', 'das', 'dos', 'em', 'no', 'na', 'com', 'por', 'pra', 'para', 'pro', 'pelo', 'ao', 'sobre', 'ref']) {
      expect(resolverFavorecidoConhecido(`Jerônimo ${c} Algo`, [JERONIMO])).toBe('Jerônimo')
    }
  })

  it('conhecido que não é prefixo, ou é prefixo parcial de palavra, não vale', () => {
    expect(resolverFavorecidoConhecido('Maria de Lourdes', [JERONIMO])).toBe('Maria de Lourdes')
    expect(resolverFavorecidoConhecido('Jeronimone de Viagem', [JERONIMO])).toBe('Jeronimone de Viagem')
    expect(resolverFavorecidoConhecido('Silva Jerônimo', [JERONIMO])).toBe('Silva Jerônimo')
  })

  it('conhecido de uma palavra x candidato de uma palavra idêntica', () => {
    expect(resolverFavorecidoConhecido('Maria', [{ chave: 'maria', nome: 'Maria' }])).toBe('Maria')
    // Conhecido mais longo que o candidato não é prefixo.
    expect(resolverFavorecidoConhecido('Maria', [{ chave: 'maria lourdes', nome: 'Maria Lourdes' }])).toBe('Maria')
  })

  it('sem conhecidos, devolve o candidato', () => {
    expect(resolverFavorecidoConhecido('Jerônimo de Viagem', [])).toBe('Jerônimo de Viagem')
  })
})

describe('interpretarFala com favorecidosConhecidos', () => {
  it('trunca o favorecido e preserva a descrição', () => {
    const texto = 'paguei 100 reais para o senhor jerônimo de viagem'
    const com = fala(texto, JERONIMO)
    const sem = interpretarFala(texto, HOJE)
    if (!sem.ok) throw new Error('esperava ok')
    expect(com.favorecido).toBe('Jerônimo')
    expect(sem.favorecido).toBe('Jerônimo de Viagem')
    expect(com.descricao).toBe(sem.descricao)
  })

  it('"referente a" e entrada', () => {
    expect(fala('paguei 50 reais para o jeronimo referente a frete', JERONIMO).favorecido).toBe('Jerônimo')
    const r = fala('recebi 100 reais do jerônimo de viagem', JERONIMO)
    expect(r.favorecido).toBe('Jerônimo')
    expect(r.valorCentavos).toBe(10000)
  })

  it('frase de referência não muda', () => {
    expect(fala('dia 12 de março paguei 120 reais para o senhor jerônimo', JERONIMO)).toEqual({
      ok: true,
      valorCentavos: -12000,
      descricao: 'Para o senhor jerônimo',
      data: '2026-03-12',
      favorecido: 'Jerônimo',
    })
  })

  it('nome diferente do conhecido mantém o comportamento atual', () => {
    expect(fala('paguei 100 reais para jerônimo silva', JERONIMO).favorecido).toBe('Jerônimo Silva')
    expect(fala('paguei 100 reais para dona maria de lourdes', JERONIMO).favorecido).toBe('Maria de Lourdes')
  })

  it('o conhecido mais longo vence', () => {
    const r = fala('paguei 100 reais para o senhor jerônimo silva de viagem', JERONIMO, { chave: 'jeronimo silva', nome: 'Jerônimo Silva' })
    expect(r.favorecido).toBe('Jerônimo Silva')
  })

  it('sem favorecido na fala não inventa', () => {
    expect(fala('200 reais de gasolina', JERONIMO).favorecido).toBeUndefined()
  })

  it('lista vazia ou ausente é idêntica ao atual', () => {
    const texto = 'paguei 100 reais para o senhor jerônimo de viagem'
    expect(interpretarFala(texto, HOJE, { favorecidosConhecidos: [] })).toEqual(interpretarFala(texto, HOJE))
    expect(interpretarFala(texto, HOJE, {})).toEqual(interpretarFala(texto, HOJE))
  })
})

describe('interpretarComando com favorecidosConhecidos', () => {
  const H = '2026-10-08'

  it('trunca o favorecido da exportação', () => {
    expect(interpretarComando('exporte as transações para o senhor jerônimo de viagem deste mês', H, opcoes(JERONIMO))).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
    })
  })

  it('exportação sem período (todo o período) também usa a grafia do conhecido', () => {
    // Task 15d: antes era `exportar_incompleto` (pergunta de período); sem período agora vale tudo.
    expect(interpretarComando('exporte para jeronimo', H, opcoes(JERONIMO))).toMatchObject({
      tipo: 'exportar',
      favorecido: 'Jerônimo',
      todoPeriodo: true,
    })
  })

  it('nome novo segue como antes', () => {
    const t = 'exporte para dona maria de lourdes deste mês'
    expect(interpretarComando(t, H, opcoes(JERONIMO))).toEqual(interpretarComando(t, H))
  })

  it('sem o parâmetro, inalterado', () => {
    expect(interpretarComando('exporte para jerônimo deste mês', H)).toMatchObject({ favorecido: 'Jerônimo' })
  })
})
