import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { lancamentos } from '@/db/schema'
import { contaSchema } from '@/features/config/schemas'
import { criarContaDoUsuario } from '@/features/config/servico'
import { listarFavorecidosDoUsuario } from '@/features/favorecido/servico'
import { lancamentoSchema, POR_PAGINA, type FiltrosLancamentos } from '@/features/lancamentos/schemas'
import {
  criarLancamentoDoUsuario,
  editarLancamentoDoUsuario,
  listarLancamentosDoUsuario,
} from '@/features/lancamentos/servico'
import { codigoPg } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

describe('favorecido nos lançamentos', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let contaA: string
  let contaB: string

  const lanc = (o: Record<string, unknown> = {}) =>
    lancamentoSchema.parse({
      valor: '100,00',
      tipo: 'saida',
      data: '2026-09-29',
      descricao: 'Pagamento',
      contaId: contaA,
      categoriaId: '',
      ...o,
    })

  const filtros = (o: Partial<FiltrosLancamentos> = {}): FiltrosLancamentos => ({ pagina: 1, ...o })

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  async function nomesPorFiltro(u: string, ws: string, f: Partial<FiltrosLancamentos>) {
    const r = await listarLancamentosDoUsuario(u, ws, filtros(f))
    return r.itens.map((l) => l.descricao).sort()
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa')
      wsB = await novoWorkspace(B, 'Casa B')
      contaA = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '' }))).id
      contaB = (await criarContaDoUsuario(B, wsB, contaSchema.parse({ nome: 'Conta B', tipo: 'corrente', saldoInicial: '' }))).id
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('app_user lê e grava as colunas novas; o schema devolve favorecido e chave', async () => {
    const l = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Primeiro', favorecido: ' Senhor  Jeová ' }))
    expect(l.favorecido).toBe('Senhor Jeová')
    expect(l.favorecidoChave).toBe('jeova')
    const lida = await listarLancamentosDoUsuario(A, wsA, filtros())
    expect(lida.itens.find((i) => i.id === l.id)).toMatchObject({ favorecido: 'Senhor Jeová', favorecidoChave: 'jeova' })
  })

  it('lançamento sem favorecido grava nulos', async () => {
    const l = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Sem favorecido' }))
    expect(l.favorecido).toBeNull()
    expect(l.favorecidoChave).toBeNull()
  })

  it('o filtro acha "Jeová" por "senhor jeova", "Jeova" e "jeová"; outro nome não casa', async () => {
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Jeová pgto', favorecido: 'Jeová' }))
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Outra pessoa', favorecido: 'José' }))
    for (const busca of ['senhor jeova', 'Jeova', 'jeová', 'jeova', '  Sr. JEOVÁ ']) {
      const nomes = await nomesPorFiltro(A, wsA, { favorecidoChave: busca })
      expect(nomes, busca).toEqual(['Jeová pgto', 'Primeiro'])
    }
    expect(await nomesPorFiltro(A, wsA, { favorecidoChave: 'jose' })).toEqual(['Outra pessoa'])
    // só tratamento → chave vazia → não casa com nada (e não vira "sem filtro")
    expect(await nomesPorFiltro(A, wsA, { favorecidoChave: 'senhor' })).toEqual([])
  })

  it('o filtro de texto livre também acha pelo nome do favorecido', async () => {
    const nomes = await nomesPorFiltro(A, wsA, { texto: 'jeová' })
    expect(nomes).toEqual(['Jeová pgto', 'Primeiro'])
    // continua achando pela descrição
    expect(await nomesPorFiltro(A, wsA, { texto: 'outra pess' })).toEqual(['Outra pessoa'])
    // % e _ continuam literais
    expect(await nomesPorFiltro(A, wsA, { texto: '%' })).toEqual([])
  })

  it('listarFavorecidos agrupa grafias na mesma chave, usa a grafia mais recente por data e conta o total', async () => {
    // Criados fora de ordem de data: o mais recente (08/10) é criado primeiro.
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Ref 3', data: '2026-10-08', valor: '300,00', favorecido: 'jeová' }))
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Ref 1', data: '2026-09-29', favorecido: 'Jeová' }))
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Ref 2', data: '2026-10-05', valor: '300,00', favorecido: 'senhor Jeova' }))
    const lista = await listarFavorecidosDoUsuario(A, wsA)
    const j = lista.filter((f) => f.chave === 'jeova')
    expect(j).toHaveLength(1)
    expect(j[0].nome).toBe('jeová')
    // Primeiro, Jeová pgto (já existentes) + 3 de referência
    expect(j[0].total).toBe(5)
    // ordenado por total desc; José (1) vem depois
    expect(lista[0].chave).toBe('jeova')
    expect(lista.map((f) => f.chave)).toEqual(['jeova', 'jose'])
  })

  it('empate de data usa criado_em mais recente para o nome', async () => {
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'T1', data: '2026-01-10', favorecido: 'Maria Antiga' }))
    await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'T2', data: '2026-01-10', favorecido: 'dona maria antiga' }))
    const m = (await listarFavorecidosDoUsuario(A, wsA)).find((f) => f.chave === 'maria antiga')
    expect(m).toMatchObject({ nome: 'dona maria antiga', total: 2 })
  })

  it('filtro por favorecido + período combinados', async () => {
    const nomes = await nomesPorFiltro(A, wsA, { favorecidoChave: 'jeova', de: '2026-09-29', ate: '2026-10-05' })
    expect(nomes).toEqual(['Jeová pgto', 'Primeiro', 'Ref 1', 'Ref 2'])
    const so = await nomesPorFiltro(A, wsA, { favorecidoChave: 'jeova', de: '2026-10-06', ate: '2026-10-31' })
    expect(so).toEqual(['Ref 3'])
  })

  it('a paginação mantém o filtro de favorecido', async () => {
    const total = POR_PAGINA + 3
    for (let i = 0; i < total; i++) {
      await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: `Muitos ${i}`, data: '2026-02-01', favorecido: 'Padaria Central' }))
    }
    const p1 = await listarLancamentosDoUsuario(A, wsA, filtros({ favorecidoChave: 'padaria central', pagina: 1 }))
    const p2 = await listarLancamentosDoUsuario(A, wsA, filtros({ favorecidoChave: 'padaria central', pagina: 2 }))
    expect(p1.total).toBe(total)
    expect(p1.itens).toHaveLength(POR_PAGINA)
    expect(p2.itens).toHaveLength(3)
    expect([...p1.itens, ...p2.itens].every((l) => l.favorecidoChave === 'padaria central')).toBe(true)
    expect(new Set([...p1.itens, ...p2.itens].map((l) => l.id)).size).toBe(total)
  }, 180000)

  it('editar para vazio limpa favorecido e chave; editar troca os dois juntos', async () => {
    const l = await criarLancamentoDoUsuario(A, wsA, lanc({ descricao: 'Editável', favorecido: 'Carlos' }))
    const trocado = await editarLancamentoDoUsuario(A, wsA, l.id, lanc({ descricao: 'Editável', favorecido: 'Dr. Pedro' }))
    expect(trocado).toMatchObject({ favorecido: 'Dr. Pedro', favorecidoChave: 'pedro' })
    const limpo = await editarLancamentoDoUsuario(A, wsA, l.id, lanc({ descricao: 'Editável', favorecido: '   ' }))
    expect(limpo.favorecido).toBeNull()
    expect(limpo.favorecidoChave).toBeNull()
    const semCampo = await editarLancamentoDoUsuario(A, wsA, l.id, lanc({ descricao: 'Editável', favorecido: 'Ana' }))
    expect(semCampo.favorecidoChave).toBe('ana')
    const semChave = await editarLancamentoDoUsuario(A, wsA, l.id, lanc({ descricao: 'Editável' }))
    expect(semChave).toMatchObject({ favorecido: null, favorecidoChave: null })
  })

  it('checks do banco: favorecido sem chave (e o inverso) e tamanhos fora de 1-80 são rejeitados', async () => {
    const tentar = async (valores: { favorecido: string | null; favorecidoChave: string | null }) => {
      try {
        await comUsuario(A, (tx) =>
          tx.insert(lancamentos).values({
            workspaceId: wsA,
            contaId: contaA,
            data: '2026-01-01',
            descricao: 'Check',
            valorCentavos: -100,
            ...valores,
          }),
        )
        return undefined
      } catch (e) {
        return codigoPg(e)
      }
    }
    expect(await tentar({ favorecido: 'Fulano', favorecidoChave: null })).toBe('23514')
    expect(await tentar({ favorecido: null, favorecidoChave: 'fulano' })).toBe('23514')
    expect(await tentar({ favorecido: '', favorecidoChave: '' })).toBe('23514')
    expect(await tentar({ favorecido: 'a'.repeat(81), favorecidoChave: 'a'.repeat(81) })).toBe('23514')
    expect(await tentar({ favorecido: 'a'.repeat(80), favorecidoChave: 'a'.repeat(80) })).toBeUndefined()
  })

  it('B não vê favorecidos nem lançamentos de A, e vice-versa', async () => {
    await criarLancamentoDoUsuario(
      B,
      wsB,
      lancamentoSchema.parse({
        valor: '10,00', tipo: 'saida', data: '2026-09-29', descricao: 'Do B', contaId: contaB, categoriaId: '', favorecido: 'Jeová',
      }),
    )
    // B enxerga só o próprio favorecido (total 1), nunca os de A
    expect(await listarFavorecidosDoUsuario(B, wsB)).toEqual([{ chave: 'jeova', nome: 'Jeová', total: 1 }])
    // B pedindo o workspace de A: RLS não devolve nada
    expect(await listarFavorecidosDoUsuario(B, wsA)).toEqual([])
    const l = await listarLancamentosDoUsuario(B, wsA, filtros({ favorecidoChave: 'jeova' }))
    expect(l).toEqual({ itens: [], total: 0 })
    // e A não vê o lançamento de B
    const doA = await listarLancamentosDoUsuario(A, wsA, filtros({ favorecidoChave: 'jeova' }))
    expect(doA.itens.some((i) => i.descricao === 'Do B')).toBe(false)
    expect((await listarFavorecidosDoUsuario(A, wsA)).find((f) => f.chave === 'jeova')?.total).toBe(5)
  })

  it('lançamentos importados continuam funcionando, sem favorecido', async () => {
    const ls = [
      { data: '2026-03-15', descricao: 'Importado 1', valorCentavos: -100, idExterno: 'fav-1' },
      { data: '2026-03-16', descricao: 'Importado 2', valorCentavos: -200, idExterno: 'fav-2' },
    ]
    const r = await comUsuario(A, (tx) =>
      tx.execute(
        sql`select * from importar_lancamentos(${wsA}::uuid, ${contaA}::uuid, ${'a.csv'}, ${'csv'}, ${JSON.stringify(ls)}::jsonb)`,
      ),
    )
    expect((r.rows[0] as { inseridos: number }).inseridos).toBe(2)
    const importados = await comUsuario(A, (tx) =>
      tx.select().from(lancamentos).where(eq(lancamentos.importacaoId, (r.rows[0] as { importacao_id: string }).importacao_id)),
    )
    expect(importados).toHaveLength(2)
    expect(importados.every((i) => i.favorecido === null && i.favorecidoChave === null)).toBe(true)
    // não aparecem como favorecido, mas aparecem na listagem comum
    expect((await listarFavorecidosDoUsuario(A, wsA)).every((f) => !f.chave.startsWith('importado'))).toBe(true)
    expect(await nomesPorFiltro(A, wsA, { texto: 'Importado' })).toEqual(['Importado 1', 'Importado 2'])
  })
})
