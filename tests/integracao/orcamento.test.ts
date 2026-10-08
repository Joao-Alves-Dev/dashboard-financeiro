import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { lancamentos, orcamentos } from '@/db/schema'
import { criarContaDoUsuario, listarCategoriasDoUsuario } from '@/features/config/servico'
import { contaSchema } from '@/features/config/schemas'
import { orcamentoVsRealizadoDoUsuario } from '@/features/dashboard/servico'
import {
  copiarMesAnteriorDoUsuario,
  listarGradeOrcamentoDoUsuario,
  salvarOrcamentoDoUsuario,
} from '@/features/orcamento/servico'
import { codigoPg, ErroDominio } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

async function rejeitaComo(p: Promise<unknown>): Promise<ErroDominio | string | undefined> {
  try {
    await p
  } catch (e) {
    if (e instanceof ErroDominio) return e
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

// Timeout folgado: a branch dev do Neon pode ter latência alta (várias idas ao banco por teste).
describe('orçamento (serviço)', { timeout: 120_000 }, () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsA2: string
  let wsB: string
  let conta: string
  let cat: Record<string, string> = {}
  let cat2: Record<string, string> = {}

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  const celula = async (u: string, ws: string, categoriaId: string, mes: string) => {
    const g = await listarGradeOrcamentoDoUsuario(u, ws, mes, 6)
    const linha = g.linhas.find((l) => l.categoriaId === categoriaId)!
    return linha.celulas.find((c) => c.mes === mes)!
  }

  async function doBanco(ws: string, categoriaId: string, mes: string) {
    return comUsuario(A, (tx) =>
      tx
        .select({ v: orcamentos.valorCentavos })
        .from(orcamentos)
        .where(and(eq(orcamentos.workspaceId, ws), eq(orcamentos.categoriaId, categoriaId), eq(orcamentos.mes, mes))),
    )
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsA2 = await novoWorkspace(A, 'Casa A2')
      wsB = await novoWorkspace(B, 'Casa B')
      conta = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '0' }))).id
      cat = Object.fromEntries((await listarCategoriasDoUsuario(A, wsA)).map((c) => [c.nome, c.id]))
      cat2 = Object.fromEntries((await listarCategoriasDoUsuario(A, wsA2)).map((c) => [c.nome, c.id]))
      const lanca = (data: string, valor: number, categoriaId: string | null, status: 'efetivado' | 'pendente' = 'efetivado') =>
        comUsuario(A, (tx) =>
          tx.insert(lancamentos).values({
            workspaceId: wsA,
            contaId: conta,
            categoriaId,
            data,
            descricao: 'x',
            valorCentavos: valor,
            status,
          }),
        )
      await lanca('2026-12-31', -1000, cat['Alimentação'])
      await lanca('2027-01-01', -2500, cat['Alimentação'])
      await lanca('2027-01-10', -300, cat['Alimentação'], 'pendente') // pendente fora
      await lanca('2027-01-15', 9000, cat['Alimentação']) // entrada fora
      await lanca('2027-01-20', -700, cat['Lazer'])
      await lanca('2027-01-21', -999, null) // sem categoria fora
      await lanca('2027-01-22', -111, cat['Salário']) // saída em categoria de receita: fora da grade
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  }, 120_000)

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  }, 120_000)

  it('grade lista só categorias de despesa e 6 meses, com realizado (31/12 e 01/01 em meses certos)', async () => {
    const g = await listarGradeOrcamentoDoUsuario(A, wsA, '2026-12-01', 6)
    expect(g.meses).toEqual(['2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01'])
    const nomes = g.linhas.map((l) => l.nome)
    expect(nomes).toContain('Alimentação')
    expect(nomes).not.toContain('Salário')
    expect(nomes).not.toContain('Outras receitas')
    const ali = g.linhas.find((l) => l.categoriaId === cat['Alimentação'])!
    expect(ali.celulas.map((c) => c.realizado)).toEqual([1000, 2500, 0, 0, 0, 0])
    expect(ali.celulas.every((c) => c.orcado === null)).toBe(true)
    const lazer = g.linhas.find((l) => l.categoriaId === cat['Lazer'])!
    expect(lazer.celulas[1].realizado).toBe(700)
    expect(g.totais[1]).toEqual({ mes: '2027-01-01', orcado: 0, realizado: 3200 })
  })

  it('salvar → listar mostra orçado e realizado; editar sobrescreve', async () => {
    await salvarOrcamentoDoUsuario(A, wsA, cat['Alimentação'], '2027-01-01', '1.000,00')
    let c = await celula(A, wsA, cat['Alimentação'], '2027-01-01')
    expect(c).toEqual({ mes: '2027-01-01', orcado: 100000, realizado: 2500 })
    await salvarOrcamentoDoUsuario(A, wsA, cat['Alimentação'], '2027-01-01', '800')
    c = await celula(A, wsA, cat['Alimentação'], '2027-01-01')
    expect(c.orcado).toBe(80000)
    expect((await doBanco(wsA, cat['Alimentação'], '2027-01-01')).length).toBe(1)
  })

  it('mês é normalizado para o dia 1 a partir de qualquer data do mês', async () => {
    await salvarOrcamentoDoUsuario(A, wsA, cat['Lazer'], '2027-01-31', '50,00')
    expect((await doBanco(wsA, cat['Lazer'], '2027-01-01'))[0].v).toBe(5000)
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, cat['Lazer'], '2027-13-01', '5'))).toMatchObject({
      chave: 'orcamento.mesInvalido',
    })
  })

  it('valor vazio apaga; valor 0 grava zero (diferente de apagar)', async () => {
    await salvarOrcamentoDoUsuario(A, wsA, cat['Lazer'], '2027-01-01', '')
    expect((await doBanco(wsA, cat['Lazer'], '2027-01-01')).length).toBe(0)
    expect((await celula(A, wsA, cat['Lazer'], '2027-01-01')).orcado).toBeNull()
    // apagar o que não existe não falha
    await salvarOrcamentoDoUsuario(A, wsA, cat['Lazer'], '2027-01-01', '   ')

    await salvarOrcamentoDoUsuario(A, wsA, cat['Lazer'], '2027-01-01', '0')
    const rows = await doBanco(wsA, cat['Lazer'], '2027-01-01')
    expect(rows.length).toBe(1)
    expect(rows[0].v).toBe(0)
    expect((await celula(A, wsA, cat['Lazer'], '2027-01-01')).orcado).toBe(0)
  })

  it('rejeita valor negativo e inválido sem gravar', async () => {
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, cat['Transporte'], '2027-01-01', '-5'))).toMatchObject({
      chave: 'orcamento.valorNegativo',
    })
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, cat['Transporte'], '2027-01-01', 'abc'))).toMatchObject({
      chave: 'orcamento.valorInvalido',
    })
    expect((await doBanco(wsA, cat['Transporte'], '2027-01-01')).length).toBe(0)
  })

  it('rejeita categoria de receita e categoria de outro workspace', async () => {
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, cat['Salário'], '2027-01-01', '100'))).toMatchObject({
      chave: 'orcamento.categoriaInvalida',
    })
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, cat2['Alimentação'], '2027-01-01', '100'))).toMatchObject({
      chave: 'orcamento.categoriaInvalida',
    })
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(A, wsA, 'nao-e-uuid', '2027-01-01', '100'))).toMatchObject({
      chave: 'orcamento.categoriaInvalida',
    })
    expect((await doBanco(wsA2, cat2['Alimentação'], '2027-01-01')).length).toBe(0)
  })

  it('copiar mês anterior copia só os que não existem e conta certo', async () => {
    // jan/2027 já tem: Alimentação 80000 e Lazer 0. Em fev/2027, Alimentação já foi editada.
    await salvarOrcamentoDoUsuario(A, wsA, cat['Transporte'], '2027-01-01', '300,00')
    await salvarOrcamentoDoUsuario(A, wsA, cat['Alimentação'], '2027-02-01', '999,00')
    const r = await copiarMesAnteriorDoUsuario(A, wsA, '2027-02-15')
    expect(r).toEqual({ copiados: 2 }) // Lazer (0) e Transporte; Alimentação preservada
    expect((await celula(A, wsA, cat['Alimentação'], '2027-02-01')).orcado).toBe(99900)
    expect((await celula(A, wsA, cat['Transporte'], '2027-02-01')).orcado).toBe(30000)
    expect((await celula(A, wsA, cat['Lazer'], '2027-02-01')).orcado).toBe(0)
    // idempotente
    expect(await copiarMesAnteriorDoUsuario(A, wsA, '2027-02-01')).toEqual({ copiados: 0 })
    // mês anterior sem nada
    expect(await copiarMesAnteriorDoUsuario(A, wsA, '2026-06-01')).toEqual({ copiados: 0 })
    // virada de ano: jan/2027 recebe de dez/2026 (vazio)
    expect(await copiarMesAnteriorDoUsuario(A, wsA, '2027-01-01')).toEqual({ copiados: 0 })
    expect(await rejeitaComo(copiarMesAnteriorDoUsuario(A, wsA, 'xx'))).toMatchObject({ chave: 'orcamento.mesInvalido' })
  })

  it('o card do dashboard (orcamento_vs_realizado) enxerga o orçamento salvo', async () => {
    const linhas = await orcamentoVsRealizadoDoUsuario(A, wsA, '2027-01-01')
    const ali = linhas.find((l) => l.categoriaId === cat['Alimentação'])!
    expect(ali).toMatchObject({ orcado: 80000, realizado: 2500 })
    expect(ali.percentual).toBeCloseTo(3.13, 2)
    // orçamento 0 gravado: o dashboard trata como sem percentual
    const lazer = linhas.find((l) => l.categoriaId === cat['Lazer'])!
    expect(lazer).toMatchObject({ orcado: 0, realizado: 700, percentual: null })
  })

  it('realizado da grade bate com o do dashboard', async () => {
    const g = await listarGradeOrcamentoDoUsuario(A, wsA, '2027-01-01', 1)
    const dash = await orcamentoVsRealizadoDoUsuario(A, wsA, '2027-01-01')
    for (const d of dash) {
      const l = g.linhas.find((x) => x.categoriaId === d.categoriaId)!
      expect(l.celulas[0].realizado).toBe(d.realizado)
      expect(l.celulas[0].orcado ?? 0).toBe(d.orcado)
    }
  })

  it('usuário B não lê, edita nem copia orçamentos de A', async () => {
    expect(await rejeitaComo(listarGradeOrcamentoDoUsuario(B, wsA, '2027-01-01', 6))).toBe('42501')
    expect(await rejeitaComo(salvarOrcamentoDoUsuario(B, wsA, cat['Alimentação'], '2027-01-01', '1'))).toBe('42501')
    expect(await rejeitaComo(copiarMesAnteriorDoUsuario(B, wsA, '2027-02-01'))).toBe('42501')
    // nada mudou
    expect((await celula(A, wsA, cat['Alimentação'], '2027-01-01')).orcado).toBe(80000)
    // B na própria casa não vê orçamento algum
    const gB = await listarGradeOrcamentoDoUsuario(B, wsB, '2027-01-01', 6)
    expect(gB.linhas.every((l) => l.celulas.every((c) => c.orcado === null))).toBe(true)
  })

  it('usuário inexistente não acessa nada', async () => {
    expect(await rejeitaComo(listarGradeOrcamentoDoUsuario('fantasma', wsA, '2027-01-01', 6))).toBe('42501')
  })
})
