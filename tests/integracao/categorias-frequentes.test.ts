import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categorias, lancamentos } from '@/db/schema'
import { contaSchema } from '@/features/config/schemas'
import { criarContaDoUsuario } from '@/features/config/servico'
import { categoriasFrequentesDoUsuario } from '@/features/lancamentos/servico'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

const HOJE = '2026-10-15' // janela: 2026-08-16 .. 2026-10-15

describe('categoriasFrequentes', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let contaA: string
  let contaB: string

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  async function cat(u: string, ws: string, nome: string, natureza = 'despesa') {
    const [c] = await comUsuario(u, (tx) => tx.insert(categorias).values({ workspaceId: ws, nome, natureza }).returning())
    return c.id
  }

  async function lanca(u: string, ws: string, conta: string, categoriaId: string | null, data: string, valor: number, n = 1) {
    await comUsuario(u, (tx) =>
      tx.insert(lancamentos).values(
        Array.from({ length: n }, () => ({
          workspaceId: ws,
          contaId: conta,
          categoriaId,
          data,
          descricao: 'x',
          valorCentavos: valor,
        })),
      ),
    )
  }

  const nomes = async (u: string, ws: string, limite?: number, hoje = HOJE) =>
    (await categoriasFrequentesDoUsuario(u, ws, hoje, limite)).map((c) => c.nome)

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsB = await novoWorkspace(B, 'Casa B')
      contaA = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '0' }))).id
      contaB = (await criarContaDoUsuario(B, wsB, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '0' }))).id
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('ordena por contagem desc e desempata por nome; ignora sem categoria, entradas e receitas', async () => {
    const zeta = await cat(A, wsA, 'Zeta')
    const alfa = await cat(A, wsA, 'Alfa')
    const beta = await cat(A, wsA, 'Beta')
    const topo = await cat(A, wsA, 'Topo')
    const rec = await cat(A, wsA, 'Salário X', 'receita')
    const soEntrada = await cat(A, wsA, 'Estorno')
    await lanca(A, wsA, contaA, topo, '2026-10-01', -100, 3)
    await lanca(A, wsA, contaA, zeta, '2026-10-02', -100, 2)
    await lanca(A, wsA, contaA, alfa, '2026-10-03', -100, 2)
    await lanca(A, wsA, contaA, beta, '2026-10-04', -100, 1)
    await lanca(A, wsA, contaA, null, '2026-10-04', -100, 9) // sem categoria
    await lanca(A, wsA, contaA, rec, '2026-10-04', -100, 9) // saída em categoria de receita
    await lanca(A, wsA, contaA, soEntrada, '2026-10-04', 500, 9) // entrada em categoria de despesa
    expect(await nomes(A, wsA)).toEqual(['Topo', 'Alfa', 'Zeta', 'Beta'])
  })

  it('respeita o limite', async () => {
    expect(await nomes(A, wsA, 2)).toEqual(['Topo', 'Alfa'])
    expect(await nomes(A, wsA, 0)).toEqual([])
  })

  it('janela de 60 dias: -60 entra, -61 fica de fora, hoje entra, amanhã não', async () => {
    const dentro = await cat(A, wsA, 'Dentro60')
    const fora = await cat(A, wsA, 'Fora61')
    const amanha = await cat(A, wsA, 'Amanha')
    await lanca(A, wsA, contaA, dentro, '2026-08-16', -100, 10)
    await lanca(A, wsA, contaA, fora, '2026-08-15', -100, 10)
    await lanca(A, wsA, contaA, dentro, '2026-10-15', -100, 1)
    await lanca(A, wsA, contaA, amanha, '2026-10-16', -100, 10)
    const r = await nomes(A, wsA, 20)
    expect(r[0]).toBe('Dentro60') // 11 lançamentos
    expect(r).not.toContain('Fora61')
    expect(r).not.toContain('Amanha')
  })

  it('virada de ano: de 2027-01-10 a janela começa em 2026-11-11', async () => {
    const dez = await cat(B, wsB, 'Dezembro')
    const nov10 = await cat(B, wsB, 'Nov10')
    const nov11 = await cat(B, wsB, 'Nov11')
    await lanca(B, wsB, contaB, dez, '2026-12-31', -100, 1)
    await lanca(B, wsB, contaB, nov11, '2026-11-11', -100, 1)
    await lanca(B, wsB, contaB, nov10, '2026-11-10', -100, 5)
    expect(await nomes(B, wsB, 6, '2027-01-10')).toEqual(['Dezembro', 'Nov11'])
  })

  it('isola workspaces: B não vê categorias de A e vice-versa', async () => {
    const deB = await nomes(B, wsB, 20, HOJE)
    expect(deB).not.toContain('Topo')
    expect(await nomes(A, wsA, 20, '2027-01-10')).not.toContain('Dezembro')
    // usuário B consultando o workspace de A: RLS devolve vazio
    expect(await nomes(B, wsA, 20)).toEqual([])
  })
})
