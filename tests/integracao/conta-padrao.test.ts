import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { contas } from '@/db/schema'
import { listarContasDoUsuario, garantirContaPadraoDoUsuario, NOME_CONTA_PADRAO } from '@/features/config/servico'
import { lancamentoSchema } from '@/features/lancamentos/schemas'
import { criarLancamentoDoUsuario, listarLancamentosDoUsuario } from '@/features/lancamentos/servico'
import { kpisDoUsuario } from '@/features/dashboard/servico'
import { interpretarFala } from '@/features/voz/interpretar-fala'
import { centavosParaCampo } from '@/lib/formato'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

/** Conta padrão invisível (Task 15d): criar_workspace e garantirContaPadraoDoUsuario. Nomes e valores fictícios. */
describe('conta padrão invisível', () => {
  let ids: string[] = []
  let A: string
  let B: string

  async function novoWorkspace(u: string, nome: string, semConta = false): Promise<string> {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    const ws = (r.rows[0] as { id: string }).id
    // Simula um workspace antigo (criado antes da migração 0011) ou com a única conta excluída.
    if (semConta) await comUsuario(u, (tx) => tx.delete(contas).where(eq(contas.workspaceId, ws)))
    return ws
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('criar_workspace cria a Carteira (dinheiro, saldo inicial 0)', async () => {
    const ws = await novoWorkspace(A, 'Casa do Roberto')
    const lista = await listarContasDoUsuario(A, ws)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ nome: 'Carteira', tipo: 'dinheiro', saldoInicialCentavos: 0 })
  })

  it('garantirContaPadrao cria a Carteira quando o workspace não tem nenhuma conta', async () => {
    const ws = await novoWorkspace(A, 'Sem conta', true)
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(0)
    const id = await garantirContaPadraoDoUsuario(A, ws)
    const lista = await listarContasDoUsuario(A, ws)
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ id, nome: NOME_CONTA_PADRAO, tipo: 'dinheiro', saldoInicialCentavos: 0 })
  })

  it('chamadas repetidas e concorrentes (5 em Promise.all) criam exatamente 1 conta', async () => {
    const ws = await novoWorkspace(A, 'Concorrência', true)
    const resultados = await Promise.all(Array.from({ length: 5 }, () => garantirContaPadraoDoUsuario(A, ws)))
    expect(new Set(resultados).size).toBe(1)
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(1)
    // E de novo, em sequência.
    expect(await garantirContaPadraoDoUsuario(A, ws)).toBe(resultados[0])
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(1)
  })

  it('workspace que já tem conta não ganha outra e devolve a existente', async () => {
    const ws = await novoWorkspace(A, 'Com conta')
    const [existente] = await listarContasDoUsuario(A, ws)
    const outra = await comUsuario(A, async (tx) => {
      const [c] = await tx
        .insert(contas)
        .values({ workspaceId: ws, nome: 'Banco Alfa', tipo: 'corrente', saldoInicialCentavos: 0 })
        .returning()
      return c
    })
    expect(await garantirContaPadraoDoUsuario(A, ws)).toBe(outra.id) // primeira por nome: "Banco Alfa"
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(2)
    expect(existente.nome).toBe('Carteira')
  })

  it('isolamento: B não cria conta no workspace de A', async () => {
    const ws = await novoWorkspace(A, 'Só do A', true)
    await expect(garantirContaPadraoDoUsuario(B, ws)).rejects.toThrow()
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(0)
    // Nem enxerga as de A quando elas existem.
    await garantirContaPadraoDoUsuario(A, ws)
    expect(await listarContasDoUsuario(B, ws)).toHaveLength(0)
    await expect(garantirContaPadraoDoUsuario(B, ws)).rejects.toThrow()
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(1)
  })

  it('voz / lançamento rápido em workspace SEM conta: cria a Carteira e grava (data completa falada)', async () => {
    const ws = await novoWorkspace(A, 'Fluxo voz', true)
    const fala = interpretarFala('paguei 100 reais para o roberto em 29 de setembro de 2026', '2026-10-08')
    if (!fala.ok) throw new Error('fala não entendida')
    // Mesmo caminho da action criarLancamento: sem conta informada, usa a conta padrão.
    const contaId = await garantirContaPadraoDoUsuario(A, ws)
    const entrada = lancamentoSchema.parse({
      valor: centavosParaCampo(Math.abs(fala.valorCentavos)),
      tipo: 'saida',
      data: fala.data,
      descricao: fala.descricao,
      contaId,
      categoriaId: '',
      status: 'efetivado',
      favorecido: fala.favorecido ?? '',
    })
    const l = await criarLancamentoDoUsuario(A, ws, entrada)
    expect(l).toMatchObject({ valorCentavos: -10000, data: '2026-09-29', favorecido: 'Roberto', contaId })
    const { itens } = await listarLancamentosDoUsuario(A, ws, { pagina: 1 })
    expect(itens).toHaveLength(1)
    expect(await listarContasDoUsuario(A, ws)).toHaveLength(1)
  })

  it('rótulo do KPI: sem saldo inicial em nenhuma conta = Resultado acumulado; com saldo = Saldo atual', async () => {
    const ws = await novoWorkspace(A, 'KPI rótulo')
    expect((await kpisDoUsuario(A, ws, '2026-10-08')).rotuloSaldo).toBe('resultadoAcumulado')
    await comUsuario(A, (tx) =>
      tx.insert(contas).values({ workspaceId: ws, nome: 'Banco Beta', tipo: 'corrente', saldoInicialCentavos: 50000 }),
    )
    expect((await kpisDoUsuario(A, ws, '2026-10-08')).rotuloSaldo).toBe('saldoAtual')
  })
})
