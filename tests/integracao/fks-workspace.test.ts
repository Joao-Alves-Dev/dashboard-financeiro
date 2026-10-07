import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categorias, contas, importacoes, lancamentos, orcamentos, regrasCategoria } from '@/db/schema'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

/** Drizzle embrulha o erro do Postgres em `cause`; confere SQLSTATE 23503 e o nome da constraint. */
async function esperaViolacaoFk(p: Promise<unknown>, constraint: string) {
  const erro = await p.then(
    () => null,
    (e: unknown) => e as { cause?: { code?: string; constraint?: string } },
  )
  expect(erro, 'esperava violação de FK').not.toBeNull()
  expect(erro?.cause?.code).toBe('23503')
  expect(erro?.cause?.constraint).toBe(constraint)
}

// FKs compostas (workspace_id, x_id): nada referencia conta/categoria/importação de outro workspace.
describe('integridade entre workspaces (FKs compostas)', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsA2: string
  let wsB: string
  let contaA: string
  let contaA2: string
  let contaB: string
  let catA: string
  let catB: string
  let impB: string

  async function novoWorkspace(u: string, nome: string): Promise<string> {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'A1')
      wsA2 = await novoWorkspace(A, 'A2')
      wsB = await novoWorkspace(B, 'B1')
      const nova = (u: string, ws: string) =>
        comUsuario(u, async (tx) => (await tx.insert(contas).values({ workspaceId: ws, nome: 'C', tipo: 'corrente' }).returning())[0].id)
      contaA = await nova(A, wsA)
      contaA2 = await nova(A, wsA2)
      contaB = await nova(B, wsB)
      const cat = (u: string, ws: string) =>
        comUsuario(u, async (tx) => (await tx.select().from(categorias).where(eq(categorias.workspaceId, ws)).limit(1))[0].id)
      catA = await cat(A, wsA)
      catB = await cat(B, wsB)
      impB = await comUsuario(B, async (tx) =>
        (await tx.insert(importacoes).values({ workspaceId: wsB, contaId: contaB, arquivoNome: 'x.ofx', formato: 'ofx' }).returning())[0].id,
      )
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  const base = () => ({ data: '2026-01-01', descricao: 'x', valorCentavos: -100 })

  it('lançamento no próprio workspace com conta de OUTRO usuário falha por FK', async () => {
    await esperaViolacaoFk(
      comUsuario(A, (tx) => tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: contaB })),
      'lancamentos_workspace_conta_fk',
    )
  })

  it('lançamento com conta de outro workspace do MESMO usuário também falha', async () => {
    await esperaViolacaoFk(
      comUsuario(A, (tx) => tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: contaA2 })),
      'lancamentos_workspace_conta_fk',
    )
  })

  it('lançamento com categoria de outro workspace falha por FK (conta válida)', async () => {
    await esperaViolacaoFk(
      comUsuario(A, (tx) =>
        tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: contaA, categoriaId: catB }),
      ),
      'lancamentos_workspace_categoria_fk',
    )
  })

  it('lançamento com importação de outro workspace falha por FK', async () => {
    await esperaViolacaoFk(
      comUsuario(A, (tx) =>
        tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: contaA, importacaoId: impB }),
      ),
      'lancamentos_workspace_importacao_fk',
    )
  })

  it('regra, orçamento e importação com referência cruzada falham por FK', async () => {
    await esperaViolacaoFk(
      comUsuario(A, (tx) => tx.insert(regrasCategoria).values({ workspaceId: wsA, padrao: 'uber', categoriaId: catB })),
      'regras_categoria_workspace_categoria_fk',
    )
    await esperaViolacaoFk(
      comUsuario(A, (tx) =>
        tx.insert(orcamentos).values({ workspaceId: wsA, categoriaId: catB, mes: '2026-01-01', valorCentavos: 100 }),
      ),
      'orcamentos_workspace_categoria_fk',
    )
    await esperaViolacaoFk(
      comUsuario(A, (tx) =>
        tx.insert(importacoes).values({ workspaceId: wsA, contaId: contaB, arquivoNome: 'y', formato: 'csv' }),
      ),
      'importacoes_workspace_conta_fk',
    )
  })

  it('excluir categoria usada mantém o lançamento com categoria_id nulo (workspace_id intacto)', async () => {
    const lid = await comUsuario(A, async (tx) =>
      (await tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: contaA, categoriaId: catA }).returning())[0].id,
    )
    await comUsuario(A, (tx) => tx.delete(categorias).where(eq(categorias.id, catA)))
    const [l] = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.id, lid)))
    expect(l.categoriaId).toBeNull()
    expect(l.workspaceId).toBe(wsA)
  })

  it('excluir conta apaga seus lançamentos (cascade)', async () => {
    const c = await comUsuario(A, async (tx) =>
      (await tx.insert(contas).values({ workspaceId: wsA, nome: 'Temp', tipo: 'dinheiro' }).returning())[0].id,
    )
    await comUsuario(A, (tx) => tx.insert(lancamentos).values({ ...base(), workspaceId: wsA, contaId: c }))
    await comUsuario(A, (tx) => tx.delete(contas).where(eq(contas.id, c)))
    expect(await comUsuario(A, (tx) => tx.select().from(lancamentos).where(and(eq(lancamentos.contaId, c))))).toEqual([])
  })
})
