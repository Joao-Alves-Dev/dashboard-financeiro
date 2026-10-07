import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categorias, lancamentos } from '@/db/schema'
import { lancamentoSchema, type FiltrosLancamentos, type LancamentoInput } from '@/features/lancamentos/schemas'
import {
  categorizarEmLoteDoUsuario,
  criarLancamentoDoUsuario,
  editarLancamentoDoUsuario,
  excluirLancamentoDoUsuario,
  listarLancamentosDoUsuario,
} from '@/features/lancamentos/servico'
import {
  criarCategoriaDoUsuario,
  criarContaDoUsuario,
  criarRegraDoUsuario,
  editarCategoriaDoUsuario,
  editarContaDoUsuario,
  editarRegraDoUsuario,
  excluirCategoriaDoUsuario,
  excluirContaDoUsuario,
  excluirRegraDoUsuario,
  listarCategoriasDoUsuario,
  listarContasDoUsuario,
  listarRegrasDoUsuario,
} from '@/features/config/servico'
import { categoriaSchema, contaSchema, regraSchema } from '@/features/config/schemas'
import { ErroDominio } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

describe('lançamentos e configurações (CRUD)', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let contaA: string
  let contaA2: string
  let contaB: string
  let catAlimentacao: string
  let catLazer: string
  let catB: string

  const lanc = (o: Record<string, unknown> = {}): LancamentoInput =>
    lancamentoSchema.parse({
      valor: '10,00',
      tipo: 'saida',
      data: '2026-03-15',
      descricao: 'Item',
      contaId: contaA,
      categoriaId: '',
      ...o,
    })

  const filtros = (o: Partial<FiltrosLancamentos> = {}): FiltrosLancamentos => ({ pagina: 1, ...o })

  async function novoWorkspace(u: string, nome: string, tipo = 'pessoal') {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, ${tipo}) as id`))
    return (r.rows[0] as { id: string }).id
  }

  function achar<T>(v: T | undefined): T {
    if (v === undefined) throw new Error('item de teste não encontrado')
    return v
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa')
      wsB = await novoWorkspace(B, 'Casa B')
      contaA = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '100,00' }))).id
      contaA2 = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Carteira', tipo: 'dinheiro', saldoInicial: '' }))).id
      contaB = (await criarContaDoUsuario(B, wsB, contaSchema.parse({ nome: 'Conta B', tipo: 'corrente', saldoInicial: '' }))).id
      const cats = await listarCategoriasDoUsuario(A, wsA)
      catAlimentacao = achar(cats.find((c) => c.nome === 'Alimentação')).id
      catLazer = achar(cats.find((c) => c.nome === 'Lazer')).id
      catB = (await listarCategoriasDoUsuario(B, wsB))[0].id
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('CRUD de lançamento: criar, listar, editar, excluir', async () => {
    const criado = await criarLancamentoDoUsuario(
      A,
      wsA,
      lanc({ valor: '1.234,56', descricao: 'Mercado', categoriaId: catAlimentacao }),
    )
    expect(criado.valorCentavos).toBe(-123456)
    expect(criado.data).toBe('2026-03-15')
    expect(criado.status).toBe('efetivado')

    const lista = await listarLancamentosDoUsuario(A, wsA, filtros())
    expect(lista.total).toBe(1)
    expect(lista.itens[0].id).toBe(criado.id)

    const editado = await editarLancamentoDoUsuario(
      A,
      wsA,
      criado.id,
      lanc({
        valor: '20,00',
        tipo: 'entrada',
        descricao: 'Reembolso',
        data: '2026-12-31',
        status: 'pendente',
        contaId: contaA2,
        categoriaId: catLazer,
      }),
    )
    expect(editado).toMatchObject({
      valorCentavos: 2000,
      descricao: 'Reembolso',
      data: '2026-12-31',
      status: 'pendente',
      contaId: contaA2,
      categoriaId: catLazer,
    })

    await excluirLancamentoDoUsuario(A, wsA, criado.id)
    expect((await listarLancamentosDoUsuario(A, wsA, filtros())).total).toBe(0)
    await expect(excluirLancamentoDoUsuario(A, wsA, criado.id)).rejects.toBeInstanceOf(ErroDominio)
  })

  it('isolamento: B não lista, edita, exclui nem categoriza em lote lançamentos de A', async () => {
    const l = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Segredo' }))

    expect((await listarLancamentosDoUsuario(B, wsA, filtros())).total).toBe(0)
    await expect(editarLancamentoDoUsuario(B, wsA, l.id, lanc({ descricao: 'Hackeado' }))).rejects.toBeInstanceOf(ErroDominio)
    await expect(editarLancamentoDoUsuario(B, wsB, l.id, lanc({ contaId: contaB }))).rejects.toBeInstanceOf(ErroDominio)
    await expect(excluirLancamentoDoUsuario(B, wsA, l.id)).rejects.toBeInstanceOf(ErroDominio)
    await expect(excluirLancamentoDoUsuario(B, wsB, l.id)).rejects.toBeInstanceOf(ErroDominio)
    await expect(categorizarEmLoteDoUsuario(B, wsA, [l.id], catB)).rejects.toThrow()
    await expect(categorizarEmLoteDoUsuario(B, wsB, [l.id], catB)).rejects.toBeInstanceOf(ErroDominio)
    // B não consegue criar em wsA
    await expect(criarLancamentoDoUsuario(B, wsA, lanc())).rejects.toThrow()

    const [intacto] = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.id, l.id)))
    expect(intacto.descricao).toBe('Segredo')
    expect(intacto.categoriaId).toBeNull()
    await excluirLancamentoDoUsuario(A, wsA, l.id)
  })

  it('A não cria lançamento no próprio workspace com conta ou categoria de B (FK composta)', async () => {
    await expect(criarLancamentoDoUsuario(A, wsA, lanc({ contaId: contaB }))).rejects.toThrow()
    await expect(criarLancamentoDoUsuario(A, wsA, lanc({ categoriaId: catB }))).rejects.toThrow()
  })

  describe('filtros', () => {
    beforeAll(async () => {
      const dados: [string, string, string, string][] = [
        ['2026-01-10', 'Uber centro', contaA, catAlimentacao],
        ['2026-02-10', 'Desconto 50% off', contaA, catLazer],
        ['2026-02-20', 'Taxa_mensal', contaA2, catLazer],
        ['2026-03-05', 'Desconto 50 reais', contaA2, ''],
        ['2026-03-05', 'Pagamento', contaA2, ''],
      ]
      for (const [data, descricao, contaId, categoriaId] of dados) {
        await criarLancamentoDoUsuario(A, wsA, lanc({ data, descricao, contaId, categoriaId }))
      }
    })
    afterAll(async () => {
      await comUsuario(A, (tx) => tx.delete(lancamentos).where(eq(lancamentos.workspaceId, wsA)))
    })

    const descs = async (f: Partial<FiltrosLancamentos>) =>
      (await listarLancamentosDoUsuario(A, wsA, filtros(f))).itens.map((i) => i.descricao)

    it('ordena por data desc e criado_em desc (desempate)', async () => {
      expect(await descs({})).toEqual(['Pagamento', 'Desconto 50 reais', 'Taxa_mensal', 'Desconto 50% off', 'Uber centro'])
    })

    it('período inclusivo', async () => {
      expect(await descs({ de: '2026-02-10', ate: '2026-02-20' })).toEqual(['Taxa_mensal', 'Desconto 50% off'])
      expect(await descs({ de: '2026-03-01' })).toHaveLength(2)
      expect(await descs({ ate: '2026-01-31' })).toEqual(['Uber centro'])
    })

    it('conta e categoria', async () => {
      expect(await descs({ contaId: contaA })).toHaveLength(2)
      expect(await descs({ categoriaId: catLazer })).toHaveLength(2)
      expect(await descs({ contaId: contaA2, categoriaId: catLazer })).toEqual(['Taxa_mensal'])
    })

    it('texto: case-insensitive, e % e _ valem literalmente', async () => {
      expect(await descs({ texto: 'uber' })).toEqual(['Uber centro'])
      expect(await descs({ texto: '50%' })).toEqual(['Desconto 50% off'])
      expect(await descs({ texto: '%' })).toEqual(['Desconto 50% off'])
      expect(await descs({ texto: 'a_m' })).toEqual(['Taxa_mensal'])
      expect(await descs({ texto: '_' })).toEqual(['Taxa_mensal'])
      expect(await descs({ texto: 'zzz' })).toEqual([])
    })
  })

  it('paginação: 51 itens → 2 páginas (50 + 1), total 51', async () => {
    await comUsuario(A, (tx) =>
      tx.insert(lancamentos).values(
        Array.from({ length: 51 }, (_, i) => ({
          workspaceId: wsA,
          contaId: contaA,
          data: '2026-05-01',
          descricao: `Pag ${i}`,
          valorCentavos: -100,
        })),
      ),
    )
    try {
      const p1 = await listarLancamentosDoUsuario(A, wsA, filtros({ pagina: 1 }))
      const p2 = await listarLancamentosDoUsuario(A, wsA, filtros({ pagina: 2 }))
      const p3 = await listarLancamentosDoUsuario(A, wsA, filtros({ pagina: 3 }))
      expect(p1.total).toBe(51)
      expect(p1.itens).toHaveLength(50)
      expect(p2.itens).toHaveLength(1)
      expect(p3.itens).toHaveLength(0)
      expect(new Set([...p1.itens, ...p2.itens].map((i) => i.id)).size).toBe(51)
    } finally {
      await comUsuario(A, (tx) => tx.delete(lancamentos).where(eq(lancamentos.workspaceId, wsA)))
    }
  })

  it('categorizarEmLote: atualiza todos; id de outro workspace → erro e NADA alterado', async () => {
    const a1 = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'L1' }))
    const a2 = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'L2' }))
    const b1 = await criarLancamentoDoUsuario(B, wsB, lanc({ descricao: 'LB', contaId: contaB }))
    const doWsA = () => comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.workspaceId, wsA)))

    try {
      const ok = await categorizarEmLoteDoUsuario(A, wsA, [a1.id, a2.id, a1.id], catLazer)
      expect(ok.atualizados).toBe(2)
      expect((await doWsA()).every((l) => l.categoriaId === catLazer)).toBe(true)

      await expect(categorizarEmLoteDoUsuario(A, wsA, [a1.id, b1.id], catAlimentacao)).rejects.toBeInstanceOf(ErroDominio)
      await expect(
        categorizarEmLoteDoUsuario(A, wsA, [a1.id, '00000000-0000-4000-8000-000000000000'], catAlimentacao),
      ).rejects.toBeInstanceOf(ErroDominio)
      // categoria de outro workspace: FK composta rejeita e a transação reverte
      await expect(categorizarEmLoteDoUsuario(A, wsA, [a1.id, a2.id], catB)).rejects.toThrow()
      expect((await doWsA()).every((l) => l.categoriaId === catLazer)).toBe(true)
      const [lb] = await comUsuario(B, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.id, b1.id)))
      expect(lb.categoriaId).toBeNull()

      await expect(categorizarEmLoteDoUsuario(A, wsA, [], catLazer)).rejects.toBeInstanceOf(ErroDominio)
      expect((await categorizarEmLoteDoUsuario(A, wsA, [a1.id], null)).atualizados).toBe(1)
    } finally {
      await comUsuario(A, (tx) => tx.delete(lancamentos).where(eq(lancamentos.workspaceId, wsA)))
    }
  })

  it('contas: criar, editar, listar com contagem; excluir exige confirmação quando há lançamentos', async () => {
    const c = await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Cartão', tipo: 'cartao', saldoInicial: '-50,00' }))
    expect(c.saldoInicialCentavos).toBe(-5000)
    const e = await editarContaDoUsuario(A, wsA, c.id, contaSchema.parse({ nome: 'Cartão Roxo', tipo: 'cartao', saldoInicial: '0' }))
    expect(e.nome).toBe('Cartão Roxo')
    await expect(
      editarContaDoUsuario(B, wsB, c.id, contaSchema.parse({ nome: 'x', tipo: 'cartao' })),
    ).rejects.toBeInstanceOf(ErroDominio)

    await criarLancamentoDoUsuario(A, wsA, lanc({ contaId: c.id }))
    await criarLancamentoDoUsuario(A, wsA, lanc({ contaId: c.id }))
    const lista = await listarContasDoUsuario(A, wsA)
    expect(lista.find((x) => x.id === c.id)?.qtdLancamentos).toBe(2)

    await expect(excluirContaDoUsuario(A, wsA, c.id, false)).rejects.toMatchObject({
      chave: 'config.contaExigeConfirmacao',
      params: { qtd: 2 },
    })
    expect((await listarContasDoUsuario(A, wsA)).some((x) => x.id === c.id)).toBe(true)
    await expect(excluirContaDoUsuario(B, wsB, c.id, true)).rejects.toBeInstanceOf(ErroDominio)

    expect(await excluirContaDoUsuario(A, wsA, c.id, true)).toEqual({ lancamentosApagados: 2 })
    expect((await listarLancamentosDoUsuario(A, wsA, filtros({ contaId: c.id }))).total).toBe(0)

    const vazia = await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Vazia', tipo: 'dinheiro' }))
    expect(await excluirContaDoUsuario(A, wsA, vazia.id, false)).toEqual({ lancamentosApagados: 0 })
  })

  it('categorias: CRUD; excluir categoria usada mantém o lançamento sem categoria e apaga as regras dela', async () => {
    const c = await criarCategoriaDoUsuario(A, wsA, categoriaSchema.parse({ nome: 'Pet', natureza: 'despesa', cor: '#112233' }))
    expect(c.cor).toBe('#112233')
    const e = await editarCategoriaDoUsuario(A, wsA, c.id, categoriaSchema.parse({ nome: 'Pets', natureza: 'despesa' }))
    expect(e).toMatchObject({ nome: 'Pets', cor: '#64748b' })
    const l = await criarLancamentoDoUsuario(A, wsA, lanc({ categoriaId: c.id }))
    const r = await criarRegraDoUsuario(A, wsA, regraSchema.parse({ padrao: 'petz', categoriaId: c.id, prioridade: '1' }))

    await expect(excluirCategoriaDoUsuario(B, wsB, c.id)).rejects.toBeInstanceOf(ErroDominio)
    await excluirCategoriaDoUsuario(A, wsA, c.id)

    const [mantido] = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.id, l.id)))
    expect(mantido.categoriaId).toBeNull()
    expect((await listarRegrasDoUsuario(A, wsA)).some((x) => x.id === r.id)).toBe(false)
    expect(await comUsuario(A, (tx) => tx.select().from(categorias).where(eq(categorias.id, c.id)))).toEqual([])
    await excluirLancamentoDoUsuario(A, wsA, l.id)
  })

  it('regras: CRUD, ordenadas por prioridade; categoria de outro workspace é rejeitada', async () => {
    const r1 = await criarRegraDoUsuario(A, wsA, regraSchema.parse({ padrao: 'uber', categoriaId: catLazer, prioridade: '1' }))
    const r2 = await criarRegraDoUsuario(A, wsA, regraSchema.parse({ padrao: 'ifood', categoriaId: catAlimentacao, prioridade: '5' }))
    expect((await listarRegrasDoUsuario(A, wsA)).map((r) => r.id)).toEqual([r2.id, r1.id])

    const e = await editarRegraDoUsuario(
      A,
      wsA,
      r1.id,
      regraSchema.parse({ padrao: 'UBER *TRIP', categoriaId: catAlimentacao, prioridade: '9' }),
    )
    expect(e).toMatchObject({ padrao: 'UBER *TRIP', prioridade: 9, categoriaId: catAlimentacao })
    expect((await listarRegrasDoUsuario(A, wsA)).map((r) => r.id)).toEqual([r1.id, r2.id])

    await expect(criarRegraDoUsuario(A, wsA, regraSchema.parse({ padrao: 'x', categoriaId: catB }))).rejects.toThrow()
    await expect(editarRegraDoUsuario(A, wsA, r1.id, regraSchema.parse({ padrao: 'x', categoriaId: catB }))).rejects.toThrow()
    await expect(
      editarRegraDoUsuario(B, wsB, r1.id, regraSchema.parse({ padrao: 'x', categoriaId: catB })),
    ).rejects.toBeInstanceOf(ErroDominio)
    await expect(excluirRegraDoUsuario(B, wsB, r1.id)).rejects.toBeInstanceOf(ErroDominio)
    expect(await listarRegrasDoUsuario(B, wsA)).toEqual([])

    await excluirRegraDoUsuario(A, wsA, r1.id)
    await excluirRegraDoUsuario(A, wsA, r2.id)
    expect(await listarRegrasDoUsuario(A, wsA)).toEqual([])
  })
})
