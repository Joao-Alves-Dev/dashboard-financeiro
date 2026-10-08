import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { user } from '@/db/auth-schema'
import { criarAuthInterno } from '@/lib/auth'
import {
  criarWorkspaceParaUsuario,
  listarWorkspacesDoUsuario,
  obterWorkspaceDoUsuario,
} from '@/features/workspaces/queries'

// Usuários de teste criados pela API do Better Auth; senha gerada aqui (valor de teste).
const exec = randomUUID().slice(0, 8)
const emails = [`auth-ws-${exec}-a@teste.invalid`, `auth-ws-${exec}-b@teste.invalid`]
let idA: string
let idB: string

async function cadastrar(email: string): Promise<string> {
  const senhaTeste = randomBytes(12).toString('hex')
  const r = await criarAuthInterno().api.signUpEmail({ body: { name: `Teste ${email}`, email, password: senhaTeste } })
  return r.user.id
}

beforeAll(async () => {
  idA = await cadastrar(emails[0])
  idB = await cadastrar(emails[1])
})

afterAll(async () => {
  // cascade remove sessões, contas, workspaces e membros
  await db.delete(user).where(inArray(user.email, emails))
})

describe('auth + workspaces', () => {
  it('Better Auth (app_user) grava usuário, conta e sessão', async () => {
    const [u] = await db.select().from(user).where(eq(user.id, idA))
    expect(u.email).toBe(emails[0])
  })

  it('cria workspace pelo caminho de /novo, e lista/obtém só para o dono', async () => {
    const wsA = await criarWorkspaceParaUsuario(idA, 'Casa', 'pessoal')
    const wsEmpresa = await criarWorkspaceParaUsuario(idA, 'Padaria', 'empresa')

    const listaA = await listarWorkspacesDoUsuario(idA)
    expect(listaA.map((w) => w.id).sort()).toEqual([wsA, wsEmpresa].sort())
    expect(listaA.find((w) => w.id === wsEmpresa)?.tipo).toBe('empresa')

    expect((await obterWorkspaceDoUsuario(idA, wsA)).nome).toBe('Casa')

    expect(await listarWorkspacesDoUsuario(idB)).toEqual([])
    await expect(obterWorkspaceDoUsuario(idB, wsA)).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
  })

  it('id que não é uuid resulta em notFound', async () => {
    await expect(obterWorkspaceDoUsuario(idA, 'abc')).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
    await expect(obterWorkspaceDoUsuario(idA, randomUUID())).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/)
  })

  it('criar_workspace rejeita tipo inválido', async () => {
    // @ts-expect-error tipo inválido de propósito
    await expect(criarWorkspaceParaUsuario(idA, 'X', 'outro')).rejects.toThrow()
  })
})
