import { describe, expect, it } from 'vitest'
import { PERIODO_TUDO } from './periodos'
import { montarRelatorio, type OpcoesRelatorio } from './relatorio'

const NB = ' '
const R = (v: string) => `R$${NB}${v}`

const jeova = [
  { data: '2026-10-08', descricao: 'Viagem', valorCentavos: -30000 },
  { data: '2026-09-29', descricao: 'Viagem', valorCentavos: -10000 },
  { data: '2026-10-05', descricao: 'Combustível', valorCentavos: -30000 },
]

const base: OpcoesRelatorio = {
  favorecido: 'Jeová',
  de: '2026-09-29',
  ate: '2026-10-08',
  tipo: 'saidas',
  mostrarTotal: false,
  anotacoes: 'descricao',
}

describe('montarRelatorio', () => {
  it('monta a lista de referência: título, período, linhas em ordem de data, sem soma', () => {
    const r = montarRelatorio(jeova, base)
    expect(r.titulo).toBe('Transações efetuadas | Jeová')
    expect(r.periodo).toBe('29/09/2026 a 08/10/2026')
    expect(r.linhas).toEqual([
      { data: '29/09/2026', anotacao: 'Viagem', valor: R('100,00') },
      { data: '05/10/2026', anotacao: 'Combustível', valor: R('300,00') },
      { data: '08/10/2026', anotacao: 'Viagem', valor: R('300,00') },
    ])
    expect(r.total).toBeUndefined()
    expect('total' in r).toBe(false)
  })

  it('mostrarTotal soma os valores exibidos', () => {
    expect(montarRelatorio(jeova, { ...base, mostrarTotal: true }).total).toBe(R('700,00'))
  })

  it("anotacoes 'branco' deixa a anotação vazia", () => {
    const r = montarRelatorio(jeova, { ...base, anotacoes: 'branco' })
    expect(r.linhas.every((l) => l.anotacao === '')).toBe(true)
  })

  it("tipo 'todas' mantém o sinal e o total é líquido", () => {
    const l = [...jeova, { data: '2026-10-06', descricao: 'Estorno', valorCentavos: 5000 }]
    const r = montarRelatorio(l, { ...base, tipo: 'todas', mostrarTotal: true })
    expect(r.linhas.map((x) => x.valor)).toEqual([
      `-R$${NB}100,00`,
      `-R$${NB}300,00`,
      R('50,00'),
      `-R$${NB}300,00`,
    ])
    expect(r.total).toBe(`-R$${NB}650,00`)
  })

  it('saídas ignora entradas; entradas ignora saídas (sem sinal)', () => {
    const l = [...jeova, { data: '2026-10-06', descricao: 'Estorno', valorCentavos: 5000 }]
    expect(montarRelatorio(l, base).linhas).toHaveLength(3)
    const e = montarRelatorio(l, { ...base, tipo: 'entradas', mostrarTotal: true })
    expect(e.linhas).toEqual([{ data: '06/10/2026', anotacao: 'Estorno', valor: R('50,00') }])
    expect(e.total).toBe(R('50,00'))
  })

  it('período inclusivo; lançamento fora não entra (31/12 e 01/01 separados)', () => {
    const l = [
      { data: '2025-12-31', descricao: 'a', valorCentavos: -100 },
      { data: '2026-01-01', descricao: 'b', valorCentavos: -200 },
    ]
    const ate = montarRelatorio(l, { ...base, de: '2025-12-01', ate: '2025-12-31' })
    expect(ate.linhas.map((x) => x.anotacao)).toEqual(['a'])
    const de = montarRelatorio(l, { ...base, de: '2026-01-01', ate: '2026-01-31' })
    expect(de.linhas.map((x) => x.anotacao)).toEqual(['b'])
  })

  it("favorecido vazio vira 'Todos'", () => {
    expect(montarRelatorio(jeova, { ...base, favorecido: '  ' }).titulo).toBe('Transações efetuadas | Todos')
  })

  it('sem linhas: lista vazia e total zero quando pedido', () => {
    const r = montarRelatorio([], { ...base, mostrarTotal: true })
    expect(r.linhas).toEqual([])
    expect(r.total).toBe(R('0,00'))
  })

  it('anotação com quebras de linha vira uma linha só', () => {
    const r = montarRelatorio([{ data: '2026-10-01', descricao: 'a\n  b', valorCentavos: -100 }], base)
    expect(r.linhas[0].anotacao).toBe('a b')
  })
})

describe('montarRelatorio: todo o período (Task 15d)', () => {
  const roberto = [
    { data: '2026-10-09', descricao: 'Frete', valorCentavos: -10000 },
    { data: '2026-09-29', descricao: 'Frete', valorCentavos: -10000 },
    { data: '2026-10-05', descricao: 'Peças', valorCentavos: -30000 },
    { data: '2026-10-08', descricao: 'Peças', valorCentavos: -30000 },
  ]
  const tudo: OpcoesRelatorio = { ...base, favorecido: 'Roberto', ...PERIODO_TUDO, todoPeriodo: true }

  it('inclui todas as datas e rotula o período pelas datas das linhas (menor e maior)', () => {
    const r = montarRelatorio(roberto, tudo)
    expect(r.linhas.map((l) => l.data)).toEqual(['29/09/2026', '05/10/2026', '08/10/2026', '09/10/2026'])
    expect(r.periodo).toBe('29/09/2026 a 09/10/2026')
    expect(r.de).toBe('2026-09-29')
    expect(r.ate).toBe('2026-10-09')
  })

  it('ignora de/ate quando todoPeriodo (mesmo com datas que excluiriam as linhas)', () => {
    const r = montarRelatorio(roberto, { ...tudo, de: '2026-10-01', ate: '2026-10-02' })
    expect(r.linhas).toHaveLength(4)
  })

  it('sem linhas: "Todo o período" e sem extremos', () => {
    const r = montarRelatorio([], tudo)
    expect(r.periodo).toBe('Todo o período')
    expect(r.de).toBeUndefined()
    expect(r.ate).toBeUndefined()
  })

  it('só os extremos das linhas que passam no filtro de tipo', () => {
    const l = [...roberto, { data: '2027-01-02', descricao: 'Estorno', valorCentavos: 5000 }]
    expect(montarRelatorio(l, tudo).periodo).toBe('29/09/2026 a 09/10/2026')
    expect(montarRelatorio(l, { ...tudo, tipo: 'todas' }).periodo).toBe('29/09/2026 a 02/01/2027')
  })

  it('período explícito também informa de/ate (extremos do intervalo pedido)', () => {
    const r = montarRelatorio(roberto, { ...base, favorecido: 'Roberto', de: '2026-09-01', ate: '2026-10-31' })
    expect(r.periodo).toBe('01/09/2026 a 31/10/2026')
    expect(r.de).toBe('2026-09-01')
    expect(r.ate).toBe('2026-10-31')
  })
})

