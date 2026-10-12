import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { contaSchema } from '@/features/config/schemas'
import { criarContaDoUsuario } from '@/features/config/servico'
import { listarLancamentosParaExportarDoUsuario } from '@/features/exportacao/servico'
import { montarRelatorio } from '@/features/exportacao/relatorio'
import { lancamentoSchema } from '@/features/lancamentos/schemas'
import { criarLancamentoDoUsuario } from '@/features/lancamentos/servico'
import { ErroDominio } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

describe('exportação de lista por favorecido e período', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let contaA: string
  let contaB: string

  const lanc = (conta: string, o: Record<string, unknown> = {}) =>
    lancamentoSchema.parse({
      valor: '100,00',
      tipo: 'saida',
      data: '2026-09-29',
      descricao: 'Pagamento',
      contaId: conta,
      categoriaId: '',
      ...o,
    })
  const criarA = (o: Record<string, unknown>) => criarLancamentoDoUsuario(A, wsA, lanc(contaA, o))

  const exportar = (p: Partial<Parameters<typeof listarLancamentosParaExportarDoUsuario>[2]>, teto?: number, u = A, ws = wsA) =>
    listarLancamentosParaExportarDoUsuario(u, ws, { de: '2020-01-01', ate: '2030-12-31', tipo: 'saidas', ...p }, teto)

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa')
      wsB = await novoWorkspace(B, 'Casa B')
      contaA = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '' }))).id
      contaB = (await criarContaDoUsuario(B, wsB, contaSchema.parse({ nome: 'Conta B', tipo: 'corrente', saldoInicial: '' }))).id

      // Os três pagamentos da conversa de referência (inseridos fora de ordem de propósito).
      await criarA({ valor: '300,00', data: '2026-10-08', descricao: 'Viagem', favorecido: 'Jeová' })
      await criarA({ valor: '100,00', data: '2026-09-29', descricao: 'Viagem', favorecido: 'Senhor Jeová' })
      await criarA({ valor: '300,00', data: '2026-10-05', descricao: 'Viagem', favorecido: 'Jeova' })
      // Ruído: outro favorecido, outro período, entrada, pendente e sem favorecido.
      await criarA({ valor: '50,00', data: '2026-10-05', descricao: 'Padaria', favorecido: 'Maria' })
      await criarA({ valor: '10,00', data: '2025-12-31', descricao: 'Fim do ano', favorecido: 'Jeová' })
      await criarA({ valor: '20,00', data: '2026-01-01', descricao: 'Começo do ano', favorecido: 'Jeová' })
      await criarA({ valor: '70,00', data: '2026-10-06', descricao: 'Devolução', tipo: 'entrada', favorecido: 'Jeová' })
      await criarA({ valor: '999,00', data: '2026-10-07', descricao: 'Ainda não pago', status: 'pendente', favorecido: 'Jeová' })
      await criarA({ valor: '15,00', data: '2026-10-07', descricao: 'Sem favorecido' })
      // Dados do usuário B com o mesmo favorecido.
      await criarLancamentoDoUsuario(B, wsB, lanc(contaB, { valor: '777,00', descricao: 'Do B', favorecido: 'Jeová' }))
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('favorecido por nome, chave ou variações ("senhor jeova", "Jeova", "JEOVÁ") dá a mesma lista', async () => {
    const base = await exportar({ favorecidoChave: 'jeova', de: '2026-09-29', ate: '2026-10-08' })
    expect(base.itens.map((i) => i.descricao)).toEqual(['Viagem', 'Viagem', 'Viagem'])
    for (const nome of ['senhor jeova', 'Jeova', 'JEOVÁ', 'Sr. Jeová', '  seu   Jeová ']) {
      const r = await exportar({ favorecidoChave: nome, de: '2026-09-29', ate: '2026-10-08' })
      expect(r.itens).toEqual(base.itens)
    }
  })

  it('ordena por data crescente e devolve a grafia mais recente do favorecido', async () => {
    const r = await exportar({ favorecidoChave: 'senhor jeova', de: '2026-09-29', ate: '2026-10-08' })
    expect(r.itens.map((i) => i.data)).toEqual(['2026-09-29', '2026-10-05', '2026-10-08'])
    expect(r.nome).toBe('Jeová') // grafia do lançamento mais recente (08/10), não a de "Senhor Jeová" ou "Jeova"
    expect(r.existe).toBe(true)
  })

  it('período inclusivo nas duas pontas e na virada 31/12 - 01/01', async () => {
    const ponta = await exportar({ favorecidoChave: 'jeova', de: '2026-09-29', ate: '2026-10-05' })
    expect(ponta.itens.map((i) => i.data)).toEqual(['2026-09-29', '2026-10-05'])
    const fim = await exportar({ favorecidoChave: 'jeova', de: '2025-12-31', ate: '2025-12-31' })
    expect(fim.itens.map((i) => i.descricao)).toEqual(['Fim do ano'])
    const inicio = await exportar({ favorecidoChave: 'jeova', de: '2026-01-01', ate: '2026-01-01' })
    expect(inicio.itens.map((i) => i.descricao)).toEqual(['Começo do ano'])
    const virada = await exportar({ favorecidoChave: 'jeova', de: '2025-12-31', ate: '2026-01-01' })
    expect(virada.itens.map((i) => i.descricao)).toEqual(['Fim do ano', 'Começo do ano'])
  })

  it("favorecido vazio = todos (inclusive sem favorecido); só efetivados; 'senhor' sozinho não vira todos", async () => {
    const todos = await exportar({ favorecidoChave: '', de: '2026-10-01', ate: '2026-10-31' })
    expect(todos.itens.map((i) => i.descricao).sort()).toEqual(['Padaria', 'Sem favorecido', 'Viagem', 'Viagem'].sort())
    expect(todos.nome).toBeNull()
    const semFiltro = await exportar({ de: '2026-10-01', ate: '2026-10-31' })
    expect(semFiltro.itens).toHaveLength(4)
    const soTratamento = await exportar({ favorecidoChave: 'senhor' })
    expect(soTratamento.itens).toEqual([])
  })

  it('pendentes ficam de fora', async () => {
    const r = await exportar({ favorecidoChave: 'jeova', tipo: 'todas', de: '2026-10-07', ate: '2026-10-07' })
    expect(r.itens).toEqual([])
  })

  it('tipo: saídas, entradas ou todas', async () => {
    const f = { favorecidoChave: 'jeova', de: '2026-10-01', ate: '2026-10-31' }
    expect((await exportar({ ...f, tipo: 'saidas' })).itens.map((i) => i.valorCentavos)).toEqual([-30000, -30000])
    expect((await exportar({ ...f, tipo: 'entradas' })).itens.map((i) => i.valorCentavos)).toEqual([7000])
    expect((await exportar({ ...f, tipo: 'todas' })).itens.map((i) => i.valorCentavos)).toEqual([-30000, 7000, -30000])
  })

  it('favorecido inexistente: lista vazia e existe=false', async () => {
    const r = await exportar({ favorecidoChave: 'fulano de tal' })
    expect(r.itens).toEqual([])
    expect(r.existe).toBe(false)
    expect(r.nome).toBeNull()
  })

  it('teto de linhas: erro amigável acima do teto, ok exatamente no teto', async () => {
    const f = { favorecidoChave: 'jeova', de: '2026-09-29', ate: '2026-10-08' }
    expect((await exportar(f, 3)).itens).toHaveLength(3)
    await expect(exportar(f, 2)).rejects.toMatchObject({ chave: 'exportacao.muitos', params: { max: 2 } })
    await expect(exportar(f, 2)).rejects.toBeInstanceOf(ErroDominio)
  })

  it('isolamento: B não exporta nada de A, e A não vê o de B', async () => {
    const deB = await exportar({ favorecidoChave: 'jeova' }, undefined, B, wsB)
    expect(deB.itens.map((i) => i.valorCentavos)).toEqual([-77700])
    const cruzado = await exportar({ favorecidoChave: 'jeova' }, undefined, B, wsA)
    expect(cruzado.itens).toEqual([])
    expect(cruzado.existe).toBe(false)
    const outroLado = await exportar({ favorecidoChave: 'jeova' }, undefined, A, wsB)
    expect(outroLado.itens).toEqual([])
  })

  it('os 3 pagamentos da conversa de referência geram a lista esperada', async () => {
    const r = await exportar({ favorecidoChave: 'senhor Jeová', de: '2026-09-29', ate: '2026-10-08' })
    const rel = montarRelatorio(r.itens, {
      favorecido: r.nome ?? 'Jeová',
      de: '2026-09-29',
      ate: '2026-10-08',
      tipo: 'saidas',
      mostrarTotal: false,
      anotacoes: 'descricao',
    })
    const NB = ' '
    expect(rel.titulo).toBe('Transações efetuadas | Jeová')
    expect(rel.periodo).toBe('29/09/2026 a 08/10/2026')
    expect(rel.linhas).toEqual([
      { data: '29/09/2026', anotacao: 'Viagem', valor: `R$${NB}100,00` },
      { data: '05/10/2026', anotacao: 'Viagem', valor: `R$${NB}300,00` },
      { data: '08/10/2026', anotacao: 'Viagem', valor: `R$${NB}300,00` },
    ])
    expect(rel.total).toBeUndefined()
  })

  it('todoPeriodo traz TODAS as datas do favorecido, ignorando de/ate (Task 15d)', async () => {
    await criarA({ valor: '40,00', data: '2024-03-10', descricao: 'Peças', favorecido: 'Roberto' })
    await criarA({ valor: '60,00', data: '2026-10-09', descricao: 'Frete', favorecido: 'Roberto' })
    // O intervalo passado exclui tudo, mas todoPeriodo manda: sem filtro de data.
    const r = await exportar({ favorecidoChave: 'roberto', de: '2026-01-01', ate: '2026-01-02', todoPeriodo: true })
    expect(r.itens.map((i) => i.data)).toEqual(['2024-03-10', '2026-10-09'])
    // Sem a flag, o filtro de data vale.
    expect((await exportar({ favorecidoChave: 'roberto', de: '2026-01-01', ate: '2026-01-02' })).itens).toEqual([])
    // Todos os favorecidos: só efetivadas, de qualquer data, e o relatório rotula pelos extremos.
    const todos = await exportar({ todoPeriodo: true, tipo: 'todas' })
    expect(todos.itens.some((i) => i.data === '2024-03-10')).toBe(true)
    expect(todos.itens.some((i) => i.descricao === 'Ainda não pago')).toBe(false)
    const rel = montarRelatorio(r.itens, {
      favorecido: 'Roberto',
      de: '1900-01-01',
      ate: '2200-12-31',
      tipo: 'saidas',
      mostrarTotal: false,
      anotacoes: 'branco',
      todoPeriodo: true,
    })
    expect(rel.periodo).toBe('10/03/2024 a 09/10/2026')
    // B não vê o Roberto de A.
    expect((await exportar({ favorecidoChave: 'roberto', todoPeriodo: true }, undefined, B, wsB)).itens).toEqual([])
  })
})
