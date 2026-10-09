import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { comUsuario } from '@/db/com-usuario'
import { aportesMeta, categorias, contas, lancamentos, metas, workspaces } from '@/db/schema'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

describe('RLS por workspace', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let contaA: string

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      const r = await comUsuario(A, (tx) => tx.execute(sql`select criar_workspace('Casa', 'pessoal') as id`))
      wsA = (r.rows[0] as { id: string }).id
      const [conta] = await comUsuario(A, (tx) =>
        tx.insert(contas).values({ workspaceId: wsA, nome: 'Corrente', tipo: 'corrente' }).returning(),
      )
      contaA = conta.id
      await comUsuario(A, (tx) =>
        tx.insert(lancamentos).values({
          workspaceId: wsA,
          contaId: contaA,
          data: '2026-12-31',
          descricao: 'Café',
          valorCentavos: -500,
        }),
      )
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('a conexão do app NÃO tem BYPASSRLS nem é superuser (não usar a role dona no DATABASE_URL)', async () => {
    const r = await db.execute(
      sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`,
    )
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false })
  })

  it('criar_workspace retorna um uuid e A enxerga o lançamento', async () => {
    expect(wsA).toMatch(/^[0-9a-f-]{36}$/)
    const rows = await comUsuario(A, (tx) => tx.select().from(lancamentos))
    expect(rows).toHaveLength(1)
    expect(rows[0].valorCentavos).toBe(-500)
    expect(rows[0].data).toBe('2026-12-31')
  })

  it('B não vê lançamentos de A', async () => {
    expect(await comUsuario(B, (tx) => tx.select().from(lancamentos))).toEqual([])
  })

  it('B não consegue inserir lançamento no workspace de A', async () => {
    await expect(
      comUsuario(B, (tx) =>
        tx.insert(lancamentos).values({
          workspaceId: wsA,
          contaId: contaA,
          data: '2026-01-01',
          descricao: 'invasão',
          valorCentavos: 100,
        }),
      ),
    ).rejects.toThrow()
  })

  it('B não vê o workspace de A', async () => {
    expect(await comUsuario(B, (tx) => tx.select().from(workspaces).where(eq(workspaces.id, wsA)))).toEqual([])
  })

  it('sem comUsuario nada é visível (falha fechado)', async () => {
    expect(await db.select().from(lancamentos)).toEqual([])
    expect(await db.select().from(workspaces)).toEqual([])
    expect(await db.select().from(categorias)).toEqual([])
  })

  it('A vê 9 categorias padrão do tipo pessoal', async () => {
    const cats = await comUsuario(A, (tx) => tx.select().from(categorias).where(eq(categorias.workspaceId, wsA)))
    expect(cats.map((c) => c.nome).sort()).toEqual(
      ['Salário', 'Outras receitas', 'Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Outros'].sort(),
    )
    expect(cats.filter((c) => c.natureza === 'receita')).toHaveLength(2)
  })

  it('B não vê categorias de A nem consegue apagar ou alterar dados de A', async () => {
    expect(await comUsuario(B, (tx) => tx.select().from(categorias))).toEqual([])
    const apagados = await comUsuario(B, (tx) =>
      tx.delete(lancamentos).where(eq(lancamentos.workspaceId, wsA)).returning(),
    )
    expect(apagados).toEqual([])
    const atualizados = await comUsuario(B, (tx) =>
      tx.update(workspaces).set({ nome: 'hack' }).where(eq(workspaces.id, wsA)).returning(),
    )
    expect(atualizados).toEqual([])
    expect(await comUsuario(A, (tx) => tx.select().from(lancamentos))).toHaveLength(1)
  })

  it('inserir workspace diretamente é negado; só criar_workspace cria', async () => {
    await expect(
      comUsuario(B, (tx) => tx.insert(workspaces).values({ nome: 'x', tipo: 'pessoal', criadoPor: B })),
    ).rejects.toThrow()
  })

  it('criar_workspace sem usuário falha e rejeita tipo inválido', async () => {
    await expect(db.execute(sql`select criar_workspace('X', 'pessoal')`)).rejects.toThrow()
    await expect(comUsuario(B, (tx) => tx.execute(sql`select criar_workspace('X', 'invalido')`))).rejects.toThrow()
  })

  it('workspace do tipo empresa recebe o conjunto de categorias da empresa', async () => {
    const r = await comUsuario(B, (tx) => tx.execute(sql`select criar_workspace('Loja', 'empresa') as id`))
    const wsB = (r.rows[0] as { id: string }).id
    const cats = await comUsuario(B, (tx) => tx.select().from(categorias).where(eq(categorias.workspaceId, wsB)))
    expect(cats.map((c) => c.nome).sort()).toEqual(
      ['Vendas', 'Serviços', 'Outras receitas', 'Fornecedores', 'Folha', 'Impostos', 'Aluguel', 'Marketing', 'Outros'].sort(),
    )
  })
})

describe('RLS de metas e aportes_meta', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let metaA: string
  let metaB: string
  let aporteA: string

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      const ra = await comUsuario(A, (tx) => tx.execute(sql`select criar_workspace('Casa A', 'pessoal') as id`))
      wsA = (ra.rows[0] as { id: string }).id
      const rb = await comUsuario(B, (tx) => tx.execute(sql`select criar_workspace('Casa B', 'pessoal') as id`))
      wsB = (rb.rows[0] as { id: string }).id
      const [ma] = await comUsuario(A, (tx) =>
        tx.insert(metas).values({ workspaceId: wsA, nome: 'Reserva', valorAlvoCentavos: 100000, dataAlvo: '2027-12-31' }).returning(),
      )
      metaA = ma.id
      const [mb] = await comUsuario(B, (tx) =>
        tx.insert(metas).values({ workspaceId: wsB, nome: 'Viagem', valorAlvoCentavos: 50000, dataAlvo: '2027-06-30' }).returning(),
      )
      metaB = mb.id
      const [ap] = await comUsuario(A, (tx) =>
        tx.insert(aportesMeta).values({ workspaceId: wsA, metaId: metaA, data: '2026-10-01', valorCentavos: 10000 }).returning(),
      )
      aporteA = ap.id
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('app_user opera nas duas tabelas (grants) e A lê o que gravou', async () => {
    expect(await comUsuario(A, (tx) => tx.select().from(metas))).toHaveLength(1)
    expect(await comUsuario(A, (tx) => tx.select().from(aportesMeta))).toHaveLength(1)
    const [m] = await comUsuario(A, (tx) => tx.update(metas).set({ nome: 'Reserva 2' }).where(eq(metas.id, metaA)).returning())
    expect(m.nome).toBe('Reserva 2')
  })

  it('B não lê metas nem aportes de A (só os seus)', async () => {
    const ms = await comUsuario(B, (tx) => tx.select().from(metas))
    expect(ms.map((x) => x.id)).toEqual([metaB])
    expect(await comUsuario(B, (tx) => tx.select().from(aportesMeta))).toEqual([])
  })

  it('B não insere meta nem aporte no workspace de A', async () => {
    await expect(
      comUsuario(B, (tx) => tx.insert(metas).values({ workspaceId: wsA, nome: 'x', valorAlvoCentavos: 1, dataAlvo: '2027-01-01' })),
    ).rejects.toThrow()
    await expect(
      comUsuario(B, (tx) => tx.insert(aportesMeta).values({ workspaceId: wsA, metaId: metaA, data: '2026-10-01', valorCentavos: 1 })),
    ).rejects.toThrow()
  })

  it('B não altera nem apaga metas e aportes de A', async () => {
    expect(await comUsuario(B, (tx) => tx.update(metas).set({ nome: 'hack' }).where(eq(metas.id, metaA)).returning())).toEqual([])
    expect(await comUsuario(B, (tx) => tx.delete(metas).where(eq(metas.id, metaA)).returning())).toEqual([])
    expect(await comUsuario(B, (tx) => tx.update(aportesMeta).set({ valorCentavos: 1 }).where(eq(aportesMeta.id, aporteA)).returning())).toEqual([])
    expect(await comUsuario(B, (tx) => tx.delete(aportesMeta).where(eq(aportesMeta.id, aporteA)).returning())).toEqual([])
    expect(await comUsuario(A, (tx) => tx.select().from(aportesMeta))).toHaveLength(1)
  })

  it('sem comUsuario nada é visível (falha fechado)', async () => {
    expect(await db.select().from(metas)).toEqual([])
    expect(await db.select().from(aportesMeta)).toEqual([])
  })

  it('FK composta: aporte no workspace próprio com meta_id de outro workspace falha (23503)', async () => {
    await expect(
      comUsuario(B, (tx) => tx.insert(aportesMeta).values({ workspaceId: wsB, metaId: metaA, data: '2026-10-01', valorCentavos: 100 })),
    ).rejects.toMatchObject({ cause: { code: '23503' } })
  })

  it('checks: valor do aporte <> 0, alvo > 0, nome 1-80, observação <= 200', async () => {
    await expect(
      comUsuario(A, (tx) => tx.insert(aportesMeta).values({ workspaceId: wsA, metaId: metaA, data: '2026-10-01', valorCentavos: 0 })),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
    await expect(
      comUsuario(A, (tx) => tx.insert(metas).values({ workspaceId: wsA, nome: 'x', valorAlvoCentavos: 0, dataAlvo: '2027-01-01' })),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
    await expect(
      comUsuario(A, (tx) => tx.insert(metas).values({ workspaceId: wsA, nome: '', valorAlvoCentavos: 1, dataAlvo: '2027-01-01' })),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
    await expect(
      comUsuario(A, (tx) => tx.insert(metas).values({ workspaceId: wsA, nome: 'a'.repeat(81), valorAlvoCentavos: 1, dataAlvo: '2027-01-01' })),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
    await expect(
      comUsuario(A, (tx) =>
        tx.insert(aportesMeta).values({ workspaceId: wsA, metaId: metaA, data: '2026-10-01', valorCentavos: 5, observacao: 'a'.repeat(201) }),
      ),
    ).rejects.toMatchObject({ cause: { code: '23514' } })
  })

  it('excluir a meta apaga seus aportes (cascade)', async () => {
    await comUsuario(A, (tx) => tx.delete(metas).where(eq(metas.id, metaA)))
    expect(await comUsuario(A, (tx) => tx.select().from(aportesMeta))).toEqual([])
  })
})
