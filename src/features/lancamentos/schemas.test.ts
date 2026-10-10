import { describe, expect, it } from 'vitest'
import { filtrosSchema, lancamentoSchema, lerFiltros } from './schemas'

const CONTA = '3f2b8c1e-6a4d-4c5e-9b7a-1d2e3f4a5b6c'
const CAT = '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

const base = {
  valor: '1.234,56',
  tipo: 'saida',
  data: '2026-03-15',
  descricao: 'Mercado',
  contaId: CONTA,
  categoriaId: CAT,
  status: 'efetivado',
}

function msgs(r: ReturnType<typeof lancamentoSchema.safeParse>) {
  return r.success ? [] : r.error.issues.map((i) => `${String(i.path[0])}:${i.message}`)
}

describe('lancamentoSchema', () => {
  it('saída de 1.234,56 vira -123456 centavos', () => {
    const r = lancamentoSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.valorCentavos).toBe(-123456)
      expect(r.data.data).toBe('2026-03-15')
      expect(r.data.categoriaId).toBe(CAT)
    }
  })

  it('entrada vira positivo; sinal digitado no campo não inverte o tipo', () => {
    const e = lancamentoSchema.safeParse({ ...base, tipo: 'entrada', valor: '10,00' })
    const n = lancamentoSchema.safeParse({ ...base, tipo: 'saida', valor: '-10,00' })
    expect(e.success && e.data.valorCentavos).toBe(1000)
    expect(n.success && n.data.valorCentavos).toBe(-1000)
  })

  it('rejeita valor zero, vazio e inválido', () => {
    expect(msgs(lancamentoSchema.safeParse({ ...base, valor: '0,00' }))).toContain('valor:validacao.valorZero')
    expect(msgs(lancamentoSchema.safeParse({ ...base, valor: '' }))).toContain('valor:validacao.valorInvalido')
    expect(msgs(lancamentoSchema.safeParse({ ...base, valor: 'abc' }))).toContain('valor:validacao.valorInvalido')
  })

  it('rejeita data inexistente (aritmética, sem fuso)', () => {
    for (const data of ['2026-02-30', '2026-13-01', '2025-02-29', 'ontem', '']) {
      expect(msgs(lancamentoSchema.safeParse({ ...base, data }))).toContain('data:validacao.dataInvalida')
    }
    expect(lancamentoSchema.safeParse({ ...base, data: '2028-02-29' }).success).toBe(true)
    expect(lancamentoSchema.safeParse({ ...base, data: '2026-12-31' }).success).toBe(true)
  })

  it('rejeita descrição vazia ou só espaços; apara espaços', () => {
    expect(msgs(lancamentoSchema.safeParse({ ...base, descricao: '   ' }))).toContain(
      'descricao:validacao.descricaoObrigatoria',
    )
    const r = lancamentoSchema.safeParse({ ...base, descricao: '  Padaria  ' })
    expect(r.success && r.data.descricao).toBe('Padaria')
  })

  it('categoria vazia vira null; uuid inválido é rejeitado; status só efetivado|pendente', () => {
    const r = lancamentoSchema.safeParse({ ...base, categoriaId: '' })
    expect(r.success && r.data.categoriaId).toBeNull()
    expect(msgs(lancamentoSchema.safeParse({ ...base, categoriaId: 'x' }))).toContain(
      'categoriaId:validacao.categoriaInvalida',
    )
    expect(lancamentoSchema.safeParse({ ...base, status: 'pendente' }).success).toBe(true)
    expect(msgs(lancamentoSchema.safeParse({ ...base, status: 'cancelado' }))).toContain(
      'status:validacao.statusInvalido',
    )
  })

  it('status ausente assume efetivado; conta obrigatória', () => {
    const { status: _s, ...semStatus } = base
    void _s
    const r = lancamentoSchema.safeParse(semStatus)
    expect(r.success && r.data.status).toBe('efetivado')
    expect(msgs(lancamentoSchema.safeParse({ ...base, contaId: '' }))).toContain('contaId:validacao.contaObrigatoria')
  })
})

describe('favorecido no lancamentoSchema', () => {
  it('ausente, vazio, espaços ou só tratamento viram null/null', () => {
    for (const favorecido of [undefined, null, '', '   ', 'Senhor']) {
      const r = lancamentoSchema.safeParse({ ...base, favorecido })
      expect(r.success && [r.data.favorecido, r.data.favorecidoChave]).toEqual([null, null])
    }
  })

  it('mantém a grafia digitada (aparada) e calcula a chave', () => {
    const r = lancamentoSchema.safeParse({ ...base, favorecido: '  Senhor   Jeová ' })
    expect(r.success && [r.data.favorecido, r.data.favorecidoChave]).toEqual(['Senhor Jeová', 'jeova'])
  })

  it('aceita 80 caracteres e rejeita 81', () => {
    expect(lancamentoSchema.safeParse({ ...base, favorecido: 'a'.repeat(80) }).success).toBe(true)
    expect(msgs(lancamentoSchema.safeParse({ ...base, favorecido: 'a'.repeat(81) }))).toContain(
      'favorecido:validacao.favorecidoLongo',
    )
  })
})

describe('filtros', () => {
  it('lerFiltros ignora valores inválidos e normaliza página', () => {
    expect(lerFiltros({})).toEqual({ pagina: 1 })
    expect(
      lerFiltros({ de: '2026-01-01', ate: '2026-02-30', contaId: 'x', categoriaId: CAT, texto: '  uber ', pagina: '3' }),
    ).toEqual({ de: '2026-01-01', categoriaId: CAT, texto: 'uber', pagina: 3 })
    expect(lerFiltros({ pagina: '0' }).pagina).toBe(1)
    expect(lerFiltros({ pagina: 'abc' }).pagina).toBe(1)
    expect(lerFiltros({ texto: ['a', 'b'] }).texto).toBe('a')
  })

  it('lerFiltros lê favorecidoChave aparado e limitado a 80', () => {
    expect(lerFiltros({ favorecidoChave: '  senhor Jeová ' }).favorecidoChave).toBe('senhor Jeová')
    expect(lerFiltros({ favorecidoChave: 'a'.repeat(200) }).favorecidoChave).toHaveLength(80)
    expect(lerFiltros({ favorecidoChave: '  ' })).toEqual({ pagina: 1 })
  })

  it('filtrosSchema aceita objeto completo', () => {
    expect(filtrosSchema.safeParse({ pagina: 1, contaId: CONTA }).success).toBe(true)
  })
})
