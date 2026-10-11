import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { db } from '@/db/cliente' // também configura o WebSocket do driver Neon
import { comUsuario } from '@/db/com-usuario'
import { user } from '@/db/auth-schema'
import { workspaceMembers } from '@/db/schema'
import { adicionarMembro, type DbOwner } from '@/features/workspaces/adicionar-membro'
import { criarWorkspaceParaUsuario, listarWorkspacesDoUsuario } from '@/features/workspaces/queries'
import { criarContaDoUsuario, listarCategoriasDoUsuario } from '@/features/config/servico'
import { contaSchema } from '@/features/config/schemas'
import { criarLancamentoDoUsuario, listarLancamentosDoUsuario } from '@/features/lancamentos/servico'
import { lancamentoSchema } from '@/features/lancamentos/schemas'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

// A função de adicionar membro exige a conexão do OWNER (app_user não escreve em workspace_members).
// O owner é usado só aqui, dentro do teste; o resto passa por comUsuario (app_user).
const urlOwner = process.env.DATABASE_URL_UNPOOLED
if (!urlOwner) throw new Error('DATABASE_URL_UNPOOLED ausente (.env.local)')

describe('adicionar membro a workspace', () => {
  const poolOwner = new Pool({ connectionString: urlOwner })
  const dbOwner = drizzle({ client: poolOwner }) as unknown as DbOwner

  let ids: string[] = []
  let A: string // dono do workspace "Casa"
  let B: string // membro
  let C: string // estranho
  let emailA: string
  let emailB: string
  let emailC: string
  let wsCasa: string
  let wsDoB: string

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(3)
      ;[A, B, C] = ids
      ;[emailA, emailB, emailC] = ids.map((id) => `${id}@teste.invalid`)
      wsCasa = await criarWorkspaceParaUsuario(A, 'Casa', 'pessoal')
      wsDoB = await criarWorkspaceParaUsuario(B, 'Do B', 'pessoal')
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

  // leitura com o owner: sem contexto de usuário o RLS esconderia as linhas do app_user
  const linhasMembro = async (ws: string, u: string) =>
    dbOwner
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, ws), eq(workspaceMembers.userId, u)))

  it('o app_user NÃO consegue se adicionar como membro (RLS) — por isso o script usa o owner', async () => {
    await expect(
      comUsuario(B, (tx) => tx.insert(workspaceMembers).values({ workspaceId: wsCasa, userId: B, papel: 'membro' })),
    ).rejects.toThrow()
    expect(await linhasMembro(wsCasa, B)).toHaveLength(0)
  })

  it('adiciona como membro; o membro vê e grava no workspace do dono; o dono não vê o do membro', async () => {
    // e-mails com maiúsculas e espaços são normalizados
    const r = await adicionarMembro(dbOwner, {
      emailDono: `  ${emailA.toUpperCase()} `,
      nomeWorkspace: '  casa ',
      emailNovoMembro: emailB,
    })
    expect(r).toMatchObject({ ok: true, resultado: 'adicionado', workspaceId: wsCasa, usuarioId: B })
    expect((await linhasMembro(wsCasa, B))[0].papel).toBe('membro')

    // B enxerga Casa e o próprio workspace
    const wsB = (await listarWorkspacesDoUsuario(B)).map((w) => w.id)
    expect(wsB).toContain(wsCasa)
    expect(wsB).toContain(wsDoB)

    // B grava no workspace do dono
    const conta = await criarContaDoUsuario(B, wsCasa, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '' }))
    const cat = (await listarCategoriasDoUsuario(B, wsCasa))[0]
    const lanc = await criarLancamentoDoUsuario(
      B,
      wsCasa,
      lancamentoSchema.parse({
        valor: '12,34',
        tipo: 'saida',
        data: '2026-03-15',
        descricao: 'Feito pelo membro',
        contaId: conta.id,
        categoriaId: cat.id,
      }),
    )
    expect(lanc.valorCentavos).toBe(-1234)

    // o dono enxerga o que o membro gravou
    const vistoPeloDono = await listarLancamentosDoUsuario(A, wsCasa, { pagina: 1 })
    expect(vistoPeloDono.itens.map((l) => l.id)).toContain(lanc.id)

    // o dono NÃO enxerga o workspace do membro, e o estranho não enxerga nenhum
    const wsA = (await listarWorkspacesDoUsuario(A)).map((w) => w.id)
    expect(wsA).toContain(wsCasa)
    expect(wsA).not.toContain(wsDoB)
    expect(await listarWorkspacesDoUsuario(C)).toEqual([])
  })

  it('é idempotente', async () => {
    const entrada = { emailDono: emailA, nomeWorkspace: 'Casa', emailNovoMembro: emailB }
    expect(await adicionarMembro(dbOwner, entrada)).toMatchObject({ ok: true, resultado: 'ja_membro' })
    expect(await linhasMembro(wsCasa, B)).toHaveLength(1)
  })

  it('erros: dono, usuário e workspace inexistentes', async () => {
    expect(
      await adicionarMembro(dbOwner, { emailDono: 'ninguem@teste.invalid', nomeWorkspace: 'Casa', emailNovoMembro: emailC }),
    ).toEqual({ ok: false, motivo: 'dono_inexistente' })
    expect(
      await adicionarMembro(dbOwner, { emailDono: emailA, nomeWorkspace: 'Casa', emailNovoMembro: 'ninguem@teste.invalid' }),
    ).toEqual({ ok: false, motivo: 'usuario_inexistente' })
    expect(
      await adicionarMembro(dbOwner, { emailDono: emailA, nomeWorkspace: 'Não existe', emailNovoMembro: emailC }),
    ).toEqual({ ok: false, motivo: 'workspace_inexistente' })
    expect(await linhasMembro(wsCasa, C)).toHaveLength(0)
  })

  it('quem é só membro não pode ser indicado como dono', async () => {
    const r = await adicionarMembro(dbOwner, { emailDono: emailB, nomeWorkspace: 'Casa', emailNovoMembro: emailC })
    expect(r).toEqual({ ok: false, motivo: 'nao_e_dono' })
    expect(await linhasMembro(wsCasa, C)).toHaveLength(0)
  })

  it('nome ambíguo: lista os candidatos e não insere', async () => {
    const d1 = await criarWorkspaceParaUsuario(A, 'Duplo', 'pessoal')
    const d2 = await criarWorkspaceParaUsuario(A, 'duplo', 'empresa')
    const r = await adicionarMembro(dbOwner, { emailDono: emailA, nomeWorkspace: 'DUPLO', emailNovoMembro: emailC })
    expect(r.ok).toBe(false)
    if (r.ok || r.motivo !== 'ambiguo') throw new Error('esperava ambiguo')
    expect(r.candidatos.map((c) => c.id).sort()).toEqual([d1, d2].sort())
    const algum = await dbOwner
      .select()
      .from(workspaceMembers)
      .where(and(inArray(workspaceMembers.workspaceId, [d1, d2]), eq(workspaceMembers.userId, C)))
    expect(algum).toHaveLength(0)
  })

  it('script adicionar-membro (processo real, stdin não-TTY) adiciona e é idempotente', () => {
    const rodar = (entrada: string) =>
      spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/adicionar-membro.ts'], {
        input: entrada,
        encoding: 'utf8',
        env: process.env,
        timeout: 100_000,
      })
    const r1 = rodar(`${emailA}\nCasa\n${emailC}\n`)
    expect(r1.status, r1.stderr).toBe(0)
    expect(r1.stdout).toContain('agora é membro')
    const r2 = rodar(`${emailA}\nCasa\n${emailC}\n`)
    expect(r2.status).toBe(0)
    expect(r2.stdout).toContain('já tem acesso')
    const r3 = rodar(`${emailA}\nNão existe\n${emailC}\n`)
    expect(r3.status).toBe(1)
    expect(r3.stderr).toContain('nenhum workspace')
  })

  it('o usuário de teste existe só durante o teste (sanidade da limpeza)', async () => {
    const r = await db.select({ id: user.id }).from(user).where(inArray(user.id, ids))
    expect(r).toHaveLength(3)
  })
})
