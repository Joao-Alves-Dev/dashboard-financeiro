import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { comUsuario } from '@/db/com-usuario'
import { categorias, contas, lancamentos, workspaces } from '@/db/schema'
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
