import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import '@/db/cliente' // configura o WebSocket do driver Neon
import { comUsuario } from '@/db/com-usuario'
import { workspaceMembers, workspaces } from '@/db/schema'
import { criarWorkspaceParaUsuario, listarWorkspacesDoUsuario } from '@/features/workspaces/queries'
import { codigoPg } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

// Auditoria de segurança (2026-10-12), migração 0012: o app_user só atualiza a coluna `nome` de
// `workspaces`, e só quando é `dono` do workspace. O membro é adicionado pela conexão do OWNER
// (app_user não escreve em workspace_members), como em membro.test.ts.
const urlOwner = process.env.DATABASE_URL_UNPOOLED
if (!urlOwner) throw new Error('DATABASE_URL_UNPOOLED ausente (.env.local)')

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (e) {
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

describe('update em workspaces: só o dono, só o nome', () => {
  const poolOwner = new Pool({ connectionString: urlOwner })
  const dbOwner = drizzle({ client: poolOwner })

  let ids: string[] = []
  let A: string // dono de "Casa"
  let B: string // membro de "Casa"
  let C: string // dono de outro workspace
  let wsCasa: string
  let wsDoC: string

  const nomeAtual = async (ws: string) =>
    (await dbOwner.select({ nome: workspaces.nome }).from(workspaces).where(eq(workspaces.id, ws)))[0]?.nome

  const renomear = (u: string, ws: string, nome: string) =>
    comUsuario(u, (tx) => tx.update(workspaces).set({ nome }).where(eq(workspaces.id, ws)).returning({ id: workspaces.id }))

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(3)
      ;[A, B, C] = ids
      wsCasa = await criarWorkspaceParaUsuario(A, 'Casa', 'pessoal')
      wsDoC = await criarWorkspaceParaUsuario(C, 'Do C', 'empresa')
      await dbOwner.insert(workspaceMembers).values({ workspaceId: wsCasa, userId: B, papel: 'membro' })
    } catch (e) {
      await apagarUsuariosTeste(ids)
      await poolOwner.end()
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
    await poolOwner.end()
  })

  it('o membro enxerga o workspace (sanidade do vínculo)', async () => {
    expect((await listarWorkspacesDoUsuario(B)).map((w) => w.id)).toContain(wsCasa)
  })

  it('o dono atualiza o nome', async () => {
    expect(await renomear(A, wsCasa, 'Casa nova')).toEqual([{ id: wsCasa }])
    expect(await nomeAtual(wsCasa)).toBe('Casa nova')
  })

  it('o membro NÃO atualiza o nome (0 linhas)', async () => {
    expect(await renomear(B, wsCasa, 'Do membro')).toEqual([])
    expect(await nomeAtual(wsCasa)).toBe('Casa nova')
  })

  it('usuário de outro workspace não atualiza (0 linhas)', async () => {
    expect(await renomear(C, wsCasa, 'Invasor')).toEqual([])
    expect(await nomeAtual(wsCasa)).toBe('Casa nova')
  })

  it('nem o dono atualiza criado_por ou tipo (42501, sem privilégio na coluna)', async () => {
    expect(
      await codigoDe(comUsuario(A, (tx) => tx.update(workspaces).set({ criadoPor: C }).where(eq(workspaces.id, wsCasa)))),
    ).toBe('42501')
    expect(
      await codigoDe(comUsuario(A, (tx) => tx.update(workspaces).set({ tipo: 'empresa' }).where(eq(workspaces.id, wsCasa)))),
    ).toBe('42501')
    const [w] = await dbOwner.select().from(workspaces).where(eq(workspaces.id, wsCasa))
    expect(w).toMatchObject({ criadoPor: A, tipo: 'pessoal' })
  })

  it('o membro também não troca o dono do workspace', async () => {
    expect(
      await codigoDe(comUsuario(B, (tx) => tx.update(workspaces).set({ criadoPor: B }).where(eq(workspaces.id, wsCasa)))),
    ).toBe('42501')
  })

  it('o dono de outro workspace continua renomeando o próprio', async () => {
    expect(await renomear(C, wsDoC, 'Do C 2')).toEqual([{ id: wsDoC }])
  })
})
