import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { comUsuario } from '@/db/com-usuario'
import { lancamentos, orcamentos } from '@/db/schema'
import { criarContaDoUsuario, listarCategoriasDoUsuario } from '@/features/config/servico'
import { contaSchema } from '@/features/config/schemas'
import {
  contasAPagarReceberDoUsuario,
  gastosPorCategoriaDoUsuario,
  kpisDoUsuario,
  orcamentoVsRealizadoDoUsuario,
  resumoMensalDoUsuario,
  ultimosLancamentosDoUsuario,
} from '@/features/dashboard/servico'
import { codigoPg } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

type Lin = Record<string, unknown>

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (e) {
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

describe('funções SQL do dashboard', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let wsEmpresa: string
  let conta: string
  let conta2: string
  let cat: Record<string, string> = {}

  const rows = async (u: string, consulta: ReturnType<typeof sql>) =>
    (await comUsuario(u, (tx) => tx.execute(consulta))).rows as Lin[]

  const resumo = (u: string, ws: string, de: string, ate: string) =>
    rows(
      u,
      sql`select mes::text as mes, entradas::text as entradas, saidas::text as saidas, resultado::text as resultado
          from resumo_mensal(${ws}::uuid, ${de}::date, ${ate}::date)`,
    )

  async function novoWorkspace(u: string, nome: string, tipo = 'pessoal') {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, ${tipo}) as id`))
    return (r.rows[0] as { id: string }).id
  }

  async function lanca(
    ws: string,
    contaId: string,
    data: string,
    valor: number,
    opts: { categoriaId?: string | null; status?: 'efetivado' | 'pendente'; descricao?: string } = {},
  ) {
    await comUsuario(A, (tx) =>
      tx.insert(lancamentos).values({
        workspaceId: ws,
        contaId,
        categoriaId: opts.categoriaId ?? null,
        data,
        descricao: opts.descricao ?? 'x',
        valorCentavos: valor,
        status: opts.status ?? 'efetivado',
      }),
    )
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsB = await novoWorkspace(B, 'Casa B')
      conta = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '1000,00' }))).id
      conta2 = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Poupança', tipo: 'corrente', saldoInicial: '-20,00' }))).id
      const cs = await listarCategoriasDoUsuario(A, wsA)
      cat = Object.fromEntries(cs.map((c) => [c.nome, c.id]))

      await lanca(wsA, conta, '2026-12-31', -1000, { categoriaId: cat['Alimentação'] })
      await lanca(wsA, conta, '2027-01-01', -2000, { categoriaId: cat['Alimentação'] })
      await lanca(wsA, conta, '2027-01-01', 50000, { categoriaId: cat['Salário'] })
      await lanca(wsA, conta, '2026-12-15', -9999, { categoriaId: cat['Saúde'], status: 'pendente' })
      await lanca(wsA, conta, '2027-01-20', -500) // sem categoria
      await lanca(wsA, conta2, '2027-01-25', -700, { categoriaId: cat['Lazer'] })
      await lanca(wsA, conta2, '2027-03-10', 300, { categoriaId: cat['Outras receitas'] })

      await comUsuario(A, (tx) =>
        tx.insert(orcamentos).values([
          { workspaceId: wsA, categoriaId: cat['Alimentação'], mes: '2027-01-01', valorCentavos: 4000 },
          { workspaceId: wsA, categoriaId: cat['Transporte'], mes: '2027-01-01', valorCentavos: 0 },
          { workspaceId: wsA, categoriaId: cat['Saúde'], mes: '2027-01-01', valorCentavos: 10000 },
        ]),
      )
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  describe('resumo_mensal', () => {
    it('31/12 e 01/01 caem em meses distintos; um registro por mês; meses vazios com zeros; pendente fora', async () => {
      const r = await resumo(A, wsA, '2026-12-01', '2027-03-31')
      expect(r).toEqual([
        { mes: '2026-12-01', entradas: '0', saidas: '1000', resultado: '-1000' }, // pendente de 9999 ignorado
        { mes: '2027-01-01', entradas: '50000', saidas: '3200', resultado: '46800' },
        { mes: '2027-02-01', entradas: '0', saidas: '0', resultado: '0' },
        { mes: '2027-03-01', entradas: '300', saidas: '0', resultado: '300' },
      ])
    })

    it('datas no meio do mês: a série vai do mês de p_de ao mês de p_ate; mês único funciona', async () => {
      const r = await resumo(A, wsA, '2026-12-15', '2027-01-02')
      expect(r.map((x) => x.mes)).toEqual(['2026-12-01', '2027-01-01'])
      const um = await resumo(A, wsA, '2027-02-10', '2027-02-10')
      expect(um).toEqual([{ mes: '2027-02-01', entradas: '0', saidas: '0', resultado: '0' }])
    })

    it('12 meses sem nenhum lançamento: 12 linhas de zeros', async () => {
      const r = await resumo(A, wsA, '2030-01-01', '2030-12-31')
      expect(r).toHaveLength(12)
      expect(r.every((x) => x.entradas === '0' && x.saidas === '0' && x.resultado === '0')).toBe(true)
    })

    it('intervalo inválido ou maior que 120 meses: 22023', async () => {
      expect(await codigoDe(resumo(A, wsA, '2027-02-01', '2027-01-01'))).toBe('22023')
      expect(await codigoDe(resumo(A, wsA, '2010-01-01', '2027-01-01'))).toBe('22023')
    })
  })

  describe('gastos_por_categoria', () => {
    it('só saídas efetivadas, positivas, com "Sem categoria", ordenadas por total desc', async () => {
      const r = await rows(
        A,
        sql`select categoria_id::text as categoria_id, nome, cor, total::text as total
            from gastos_por_categoria(${wsA}::uuid, '2027-01-01'::date, '2027-01-31'::date)`,
      )
      expect(r.map((x) => [x.nome, x.total])).toEqual([
        ['Alimentação', '2000'],
        ['Lazer', '700'],
        ['Sem categoria', '500'],
      ])
      expect(r[2].categoria_id).toBeNull()
      expect(r[0].categoria_id).toBe(cat['Alimentação'])
      expect(r[0].cor).toMatch(/^#/)
    })

    it('intervalo inclusivo nas duas pontas (31/12 só no intervalo que o contém)', async () => {
      const dez = await rows(A, sql`select nome, total::text as total from gastos_por_categoria(${wsA}::uuid, '2026-12-31'::date, '2026-12-31'::date)`)
      expect(dez).toEqual([{ nome: 'Alimentação', total: '1000' }])
      const jan = await rows(A, sql`select nome from gastos_por_categoria(${wsA}::uuid, '2027-01-01'::date, '2027-01-01'::date)`)
      expect(jan.map((x) => x.nome)).toEqual(['Alimentação'])
    })
  })

  describe('orcamento_vs_realizado', () => {
    it('percentual, orçado zero, orçado sem gasto, gasto sem orçamento; pendente e receitas fora', async () => {
      const r = await rows(
        A,
        sql`select nome, orcado::text as orcado, realizado::text as realizado, percentual::text as percentual
            from orcamento_vs_realizado(${wsA}::uuid, '2027-01-17'::date)`,
      )
      const por = Object.fromEntries(r.map((x) => [x.nome as string, x]))
      expect(por['Alimentação']).toMatchObject({ orcado: '4000', realizado: '2000', percentual: '50.00' })
      expect(por['Lazer']).toMatchObject({ orcado: '0', realizado: '700', percentual: null })
      expect(por['Transporte']).toMatchObject({ orcado: '0', realizado: '0', percentual: null })
      expect(por['Saúde']).toMatchObject({ orcado: '10000', realizado: '0', percentual: '0.00' }) // pendente não conta
      expect(por['Salário']).toBeUndefined() // receita
      expect(por['Moradia']).toBeUndefined() // sem orçamento nem gasto
      expect(r).toHaveLength(4)
    })

    it('mês sem nada retorna vazio', async () => {
      expect(await rows(A, sql`select * from orcamento_vs_realizado(${wsA}::uuid, '2030-05-01'::date)`)).toEqual([])
    })
  })

  describe('saldo_atual', () => {
    it('saldo inicial das contas + todos os efetivados; pendentes de fora', async () => {
      const r = await rows(A, sql`select saldo_atual(${wsA}::uuid)::text as s`)
      // 100000 - 2000 (iniciais) + (-1000 -2000 +50000 -500 -700 +300) = 98000 + 46100
      expect(r[0].s).toBe('144100')
    })

    it('workspace sem contas nem lançamentos: zero', async () => {
      expect((await rows(B, sql`select saldo_atual(${wsB}::uuid)::text as s`))[0].s).toBe('0')
    })
  })

  describe('isolamento', () => {
    it('B recebe erro 42501 em todas as funções com o workspace de A', async () => {
      expect(await codigoDe(resumo(B, wsA, '2027-01-01', '2027-01-31'))).toBe('42501')
      expect(await codigoDe(rows(B, sql`select * from gastos_por_categoria(${wsA}::uuid, '2027-01-01'::date, '2027-01-31'::date)`))).toBe('42501')
      expect(await codigoDe(rows(B, sql`select * from orcamento_vs_realizado(${wsA}::uuid, '2027-01-01'::date)`))).toBe('42501')
      expect(await codigoDe(rows(B, sql`select saldo_atual(${wsA}::uuid)`))).toBe('42501')
    })

    it('sem usuário (fora de comUsuario): 28000; workspace nulo: 22023', async () => {
      expect(await codigoDe(db.execute(sql`select saldo_atual(${wsA}::uuid)`))).toBe('28000')
      expect(await codigoDe(rows(A, sql`select saldo_atual(null::uuid)`))).toBe('22023')
    })

    it('camada de serviço: B não lê nada de A', async () => {
      const hoje = '2027-01-17'
      await expect(kpisDoUsuario(B, wsA, hoje)).rejects.toBeTruthy()
      await expect(resumoMensalDoUsuario(B, wsA, '2027-01-01', '2027-01-31')).rejects.toBeTruthy()
      await expect(gastosPorCategoriaDoUsuario(B, wsA, '2027-01-01', '2027-01-31')).rejects.toBeTruthy()
      await expect(orcamentoVsRealizadoDoUsuario(B, wsA, '2027-01-01')).rejects.toBeTruthy()
      expect(await ultimosLancamentosDoUsuario(B, wsA, 10)).toEqual([]) // RLS: sem linhas
      expect(await contasAPagarReceberDoUsuario(B, wsA, hoje)).toMatchObject({ totalAPagar: 0, totalAReceber: 0, proximos: [] })
    })
  })

  describe('camada de serviço (tipos e fronteiras de mês)', () => {
    it('kpisDoUsuario: mês corrente e anterior, com variação nula quando o anterior é zero', async () => {
      const k = await kpisDoUsuario(A, wsA, '2027-01-17')
      expect(k).toMatchObject({
        saldoAtual: 144100,
        mes: { entradas: 50000, saidas: 3200, resultado: 46800 },
        anterior: { entradas: 0, saidas: 1000, resultado: -1000 },
        variacao: { entradas: null, saidas: 220, resultado: 4780 },
      })
    })

    it('kpis em 01/01 e em 31/12 usam o mês certo (sem deslocamento de fuso)', async () => {
      const dez = await kpisDoUsuario(A, wsA, '2026-12-31')
      expect(dez.mes).toMatchObject({ entradas: 0, saidas: 1000 })
      const jan = await kpisDoUsuario(A, wsA, '2027-01-01')
      expect(jan.mes).toMatchObject({ entradas: 50000, saidas: 3200 })
      expect(jan.anterior).toMatchObject({ saidas: 1000 })
    })

    it('últimos lançamentos: no máximo N, mais recentes primeiro, com nome de categoria e conta', async () => {
      const l = await ultimosLancamentosDoUsuario(A, wsA, 3)
      expect(l).toHaveLength(3)
      expect(l[0].data).toBe('2027-03-10')
      expect(l[0]).toMatchObject({ categoriaNome: 'Outras receitas', contaNome: 'Poupança', valorCentavos: 300 })
      expect(typeof l[0].data).toBe('string')
    })
  })

  describe('a pagar / a receber (empresa)', () => {
    it('pendentes entre hoje e hoje+30 (inclusivos), separados por sinal; efetivados e fora da janela excluídos', async () => {
      wsEmpresa = await novoWorkspace(A, 'Padaria', 'empresa')
      const c = (await criarContaDoUsuario(A, wsEmpresa, contaSchema.parse({ nome: 'Caixa', tipo: 'corrente', saldoInicial: '' }))).id
      const hoje = '2026-12-20'
      await lanca(wsEmpresa, c, '2026-12-20', -10000, { status: 'pendente', descricao: 'Hoje pagar' })
      await lanca(wsEmpresa, c, '2027-01-19', -5000, { status: 'pendente', descricao: 'Último dia' }) // hoje+30
      await lanca(wsEmpresa, c, '2027-01-20', -7777, { status: 'pendente', descricao: 'Fora' }) // hoje+31
      await lanca(wsEmpresa, c, '2026-12-19', -3333, { status: 'pendente', descricao: 'Vencido' }) // antes de hoje
      await lanca(wsEmpresa, c, '2027-01-01', 30000, { status: 'pendente', descricao: 'Receber ano novo' })
      await lanca(wsEmpresa, c, '2026-12-25', -4444, { status: 'efetivado', descricao: 'Já pago' })
      const r = await contasAPagarReceberDoUsuario(A, wsEmpresa, hoje)
      expect(r.totalAPagar).toBe(15000)
      expect(r.totalAReceber).toBe(30000)
      expect(r.qtdAPagar).toBe(2)
      expect(r.qtdAReceber).toBe(1)
      expect(r.proximos.map((p) => [p.data, p.descricao, p.valorCentavos])).toEqual([
        ['2026-12-20', 'Hoje pagar', -10000],
        ['2027-01-01', 'Receber ano novo', 30000],
        ['2027-01-19', 'Último dia', -5000],
      ])
    })
  })
})
