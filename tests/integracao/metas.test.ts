import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { aportesMeta, contas, lancamentos, metas } from '@/db/schema'
import { calcularMeta } from '@/features/metas/calcular-meta'
import { aporteSchema, metaSchema } from '@/features/metas/schemas'
import {
  criarMetaDoUsuario,
  editarMetaDoUsuario,
  excluirAporteDoUsuario,
  excluirMetaDoUsuario,
  listarAportesDoUsuario,
  listarMetasDoUsuario,
  registrarAporteDoUsuario,
  sobraMedia3MesesDoUsuario,
} from '@/features/metas/servico'
import { codigoPg, ErroDominio } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

async function rejeitaComo(p: Promise<unknown>): Promise<ErroDominio | string | undefined> {
  try {
    await p
  } catch (e) {
    if (e instanceof ErroDominio) return e
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

const meta = (nome: string, valorAlvo: string, dataAlvo: string) => metaSchema.parse({ nome, valorAlvo, dataAlvo })
const aporte = (valor: string, data = '2026-10-01', observacao?: string) => aporteSchema.parse({ valor, data, observacao })

describe('metas de poupança (serviço)', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let wsSobra: string
  let wsVazio: string
  let wsArred: string

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  async function lancar(u: string, ws: string, contaId: string, data: string, valor: number, status: 'efetivado' | 'pendente' = 'efetivado') {
    await comUsuario(u, (tx) =>
      tx.insert(lancamentos).values({ workspaceId: ws, contaId, data, descricao: 'x', valorCentavos: valor, status }),
    )
  }

  async function conta(u: string, ws: string) {
    const [c] = await comUsuario(u, (tx) => tx.insert(contas).values({ workspaceId: ws, nome: 'Corrente', tipo: 'corrente' }).returning())
    return c.id
  }

  const doBanco = (u: string, id: string) => comUsuario(u, (tx) => tx.select().from(metas).where(eq(metas.id, id)))

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsB = await novoWorkspace(B, 'Casa B')
      wsSobra = await novoWorkspace(A, 'Sobra')
      wsVazio = await novoWorkspace(A, 'Vazio')
      wsArred = await novoWorkspace(A, 'Arredondamento')

      // hoje = 2027-01-10 -> meses fechados: out, nov e dez de 2026 (virada de ano).
      const c = await conta(A, wsSobra)
      await lancar(A, wsSobra, c, '2026-10-01', 1_000_000)
      await lancar(A, wsSobra, c, '2026-10-31', -400_000) // out: +600.000
      await lancar(A, wsSobra, c, '2026-11-05', 1_000_000)
      await lancar(A, wsSobra, c, '2026-11-30', -1_200_000) // nov: -200.000
      // dez: sem lançamentos -> conta 0
      await lancar(A, wsSobra, c, '2026-09-30', 9_999_999) // set: fora da janela
      await lancar(A, wsSobra, c, '2027-01-02', 8_888_888) // mês corrente: fora
      await lancar(A, wsSobra, c, '2026-12-15', -7_777_777, 'pendente') // pendente: fora

      const c2 = await conta(A, wsArred)
      await lancar(A, wsArred, c2, '2026-12-31', 2) // dez: +2 -> média 2/3 = 0,67 -> 1
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  }, 120_000)

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  }, 120_000)

  it('CRUD de meta: criar, listar, editar e excluir sem aportes', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Reserva de emergência', '10.000,00', '2027-09-30'))
    expect(m).toMatchObject({ nome: 'Reserva de emergência', valorAlvoCentavos: 1_000_000, dataAlvo: '2027-09-30', concluidaEm: null })

    const lista = await listarMetasDoUsuario(A, wsA, '2026-10-15')
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ id: m.id, guardado: 0 })

    const e = await editarMetaDoUsuario(A, wsA, m.id, meta('Reserva', '12.000,00', '2028-01-31'))
    expect(e).toMatchObject({ nome: 'Reserva', valorAlvoCentavos: 1_200_000, dataAlvo: '2028-01-31' })

    expect(await excluirMetaDoUsuario(A, wsA, m.id, false)).toEqual({ aportesApagados: 0 })
    expect(await doBanco(A, m.id)).toEqual([])
  })

  it('guardado = soma dos aportes (aporte + retirada); retirada maior que o guardado é rejeitada', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Viagem', '5.000,00', '2027-06-30'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('300,00'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('200,00', '2026-10-05', 'bônus'))
    const r = await registrarAporteDoUsuario(A, wsA, m.id, aporte('-100,00', '2026-10-06'))
    expect(r.guardado).toBe(40_000)

    let l = (await listarMetasDoUsuario(A, wsA, '2026-10-15')).find((x) => x.id === m.id)!
    expect(l.guardado).toBe(40_000)

    const erro = await rejeitaComo(registrarAporteDoUsuario(A, wsA, m.id, aporte('-400,01')))
    expect(erro).toBeInstanceOf(ErroDominio)
    expect((erro as ErroDominio).chave).toBe('metas.erros.retiradaMaiorQueGuardado')
    // retirada exatamente igual ao guardado é permitida
    const zero = await registrarAporteDoUsuario(A, wsA, m.id, aporte('-400,00'))
    expect(zero.guardado).toBe(0)

    l = (await listarMetasDoUsuario(A, wsA, '2026-10-15')).find((x) => x.id === m.id)!
    expect(l.guardado).toBe(0)

    const aps = (await listarAportesDoUsuario(A, wsA)).filter((a) => a.metaId === m.id)
    expect(aps).toHaveLength(4)
    expect(aps.find((a) => a.observacao === 'bônus')).toMatchObject({ valorCentavos: 20_000, data: '2026-10-05' })
  })

  it('concluida_em: marcado ao atingir o alvo, preservado em novos aportes, limpo ao cair abaixo', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Notebook', '1.000,00', '2027-03-31'))
    const a1 = await registrarAporteDoUsuario(A, wsA, m.id, aporte('999,99'))
    expect(a1.concluida).toBe(false)
    expect((await doBanco(A, m.id))[0].concluidaEm).toBeNull()

    const a2 = await registrarAporteDoUsuario(A, wsA, m.id, aporte('0,01'))
    expect(a2.concluida).toBe(true)
    const marcada = (await doBanco(A, m.id))[0].concluidaEm
    expect(marcada).not.toBeNull()
    let l = (await listarMetasDoUsuario(A, wsA, '2026-10-15')).find((x) => x.id === m.id)!
    expect(l.calculo).toMatchObject({ situacao: 'concluida', necessarioPorMes: 0, faltam: 0 })

    // novo aporte acima do alvo mantém o instante original
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('50,00'))
    expect((await doBanco(A, m.id))[0].concluidaEm).toEqual(marcada)

    // retirada que derruba abaixo do alvo limpa
    const ret = await registrarAporteDoUsuario(A, wsA, m.id, aporte('-100,00'))
    expect(ret).toMatchObject({ concluida: false, guardado: 95_000 })
    expect((await doBanco(A, m.id))[0].concluidaEm).toBeNull()
    l = (await listarMetasDoUsuario(A, wsA, '2026-10-15')).find((x) => x.id === m.id)!
    expect(l.calculo.situacao).not.toBe('concluida')

    // excluir a retirada reconclui; excluir um aporte que deixa < alvo reabre
    const aps = (await listarAportesDoUsuario(A, wsA)).filter((a) => a.metaId === m.id)
    const retirada = aps.find((a) => a.valorCentavos === -10_000)!
    expect((await excluirAporteDoUsuario(A, wsA, retirada.id)).concluida).toBe(true)
    expect((await doBanco(A, m.id))[0].concluidaEm).not.toBeNull()
    const cinquenta = aps.find((a) => a.valorCentavos === 5_000)!
    const apos = await excluirAporteDoUsuario(A, wsA, cinquenta.id)
    expect(apos).toEqual({ guardado: 100_000, concluida: true })
    const um = aps.find((a) => a.valorCentavos === 1)!
    expect((await excluirAporteDoUsuario(A, wsA, um.id)).concluida).toBe(false)
    expect((await doBanco(A, m.id))[0].concluidaEm).toBeNull()
  })

  it('editar o alvo sincroniza a conclusão (alvo menor conclui, maior reabre)', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Curso', '1.000,00', '2027-03-31'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('500,00'))
    expect((await doBanco(A, m.id))[0].concluidaEm).toBeNull()
    const e1 = await editarMetaDoUsuario(A, wsA, m.id, meta('Curso', '400,00', '2027-03-31'))
    expect(e1.concluidaEm).not.toBeNull()
    const e2 = await editarMetaDoUsuario(A, wsA, m.id, meta('Curso', '2.000,00', '2027-03-31'))
    expect(e2.concluidaEm).toBeNull()
  })

  it('excluir aporte que deixaria o guardado negativo é rejeitado', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Moto', '9.000,00', '2027-03-31'))
    const a = await registrarAporteDoUsuario(A, wsA, m.id, aporte('100,00'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('-80,00'))
    const erro = await rejeitaComo(excluirAporteDoUsuario(A, wsA, a.id))
    expect((erro as ErroDominio).chave).toBe('metas.erros.excluirDeixaNegativo')
    expect((await listarAportesDoUsuario(A, wsA)).filter((x) => x.metaId === m.id)).toHaveLength(2)
  })

  it('excluirMeta com aportes exige confirmar e apaga os aportes (cascade)', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Reforma', '3.000,00', '2027-03-31'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('10,00'))
    await registrarAporteDoUsuario(A, wsA, m.id, aporte('20,00'))

    const erro = await rejeitaComo(excluirMetaDoUsuario(A, wsA, m.id, false))
    expect(erro).toBeInstanceOf(ErroDominio)
    expect((erro as ErroDominio).chave).toBe('metas.erros.exigeConfirmacao')
    expect((erro as ErroDominio).params).toEqual({ qtd: 2 })
    expect(await doBanco(A, m.id)).toHaveLength(1)

    expect(await excluirMetaDoUsuario(A, wsA, m.id, true)).toEqual({ aportesApagados: 2 })
    expect(await doBanco(A, m.id)).toEqual([])
    const restantes = await comUsuario(A, (tx) => tx.select().from(aportesMeta).where(eq(aportesMeta.metaId, m.id)))
    expect(restantes).toEqual([])
  })

  it('isolamento: B não vê nem altera metas e aportes de A', async () => {
    const m = await criarMetaDoUsuario(A, wsA, meta('Privada', '1.000,00', '2027-03-31'))
    const ap = await registrarAporteDoUsuario(A, wsA, m.id, aporte('50,00'))

    // B no workspace de A: sem acesso
    expect(await rejeitaComo(listarMetasDoUsuario(B, wsA, '2026-10-15'))).toBe('42501')
    expect(await rejeitaComo(listarAportesDoUsuario(B, wsA))).toBe('42501')
    expect(await rejeitaComo(criarMetaDoUsuario(B, wsA, meta('x', '1', '2027-01-01')))).toBe('42501')
    expect(await rejeitaComo(registrarAporteDoUsuario(B, wsA, m.id, aporte('1,00')))).toBe('42501')
    expect(await rejeitaComo(excluirAporteDoUsuario(B, wsA, ap.id))).toBe('42501')
    expect(await rejeitaComo(sobraMedia3MesesDoUsuario(B, wsA, '2026-10-15'))).toBe('42501')

    // B no próprio workspace tentando usar ids de A: não encontrada (RLS esconde as linhas)
    for (const tentativa of [
      () => editarMetaDoUsuario(B, wsB, m.id, meta('hack', '1', '2027-01-01')),
      () => excluirMetaDoUsuario(B, wsB, m.id, true),
      () => registrarAporteDoUsuario(B, wsB, m.id, aporte('1,00')),
    ]) {
      const e = await rejeitaComo(tentativa())
      expect(e).toBeInstanceOf(ErroDominio)
      expect((e as ErroDominio).chave).toBe('metas.erros.naoEncontrada')
    }
    const e2 = await rejeitaComo(excluirAporteDoUsuario(B, wsB, ap.id))
    expect((e2 as ErroDominio).chave).toBe('metas.erros.aporteNaoEncontrado')

    expect(await listarMetasDoUsuario(B, wsB, '2026-10-15')).toEqual([])
    const intacta = (await listarMetasDoUsuario(A, wsA, '2026-10-15')).find((x) => x.id === m.id)!
    expect(intacta).toMatchObject({ nome: 'Privada', guardado: 5_000 })
  })

  it('workspace inválido (não uuid) é negado', async () => {
    expect(await rejeitaComo(listarMetasDoUsuario(A, 'abc', '2026-10-15'))).toBeInstanceOf(ErroDominio)
  })

  describe('sobraMedia3Meses', () => {
    it('média dos 3 meses fechados na virada de ano (hoje 2027-01-10 -> out/nov/dez de 2026); dez vazio conta 0', async () => {
      // (600.000 - 200.000 + 0) / 3 = 133.333,33 -> 133.333
      expect(await sobraMedia3MesesDoUsuario(A, wsSobra, '2027-01-10')).toBe(133_333)
    })

    it('mês corrente, mês anterior à janela e pendentes não entram', async () => {
      // hoje no dia 1 de jan: ainda exclui janeiro. Janela continua out-dez.
      expect(await sobraMedia3MesesDoUsuario(A, wsSobra, '2027-01-01')).toBe(133_333)
      // hoje em fev/2027: janela nov, dez, jan -> (-200.000 + 0 + 8.888.888) / 3 = 2.896.296,00
      expect(await sobraMedia3MesesDoUsuario(A, wsSobra, '2027-02-10')).toBe(2_896_296)
    })

    it('workspace sem nenhum lançamento nos 3 meses = 0', async () => {
      expect(await sobraMedia3MesesDoUsuario(A, wsVazio, '2027-01-10')).toBe(0)
    })

    it('arredonda ao inteiro mais próximo (2/3 -> 1)', async () => {
      expect(await sobraMedia3MesesDoUsuario(A, wsArred, '2027-01-10')).toBe(1)
    })

    it('listarMetas devolve calculo coerente com calcularMeta e ordem de urgência', async () => {
      const hoje = '2027-01-10'
      const atrasada = await criarMetaDoUsuario(A, wsSobra, meta('Reserva de emergência', '10.000,00', '2027-09-30'))
      const concluida = await criarMetaDoUsuario(A, wsSobra, meta('Cadeira', '100,00', '2026-12-31'))
      await registrarAporteDoUsuario(A, wsSobra, atrasada.id, aporte('2.800,00'))
      await registrarAporteDoUsuario(A, wsSobra, concluida.id, aporte('100,00'))

      const lista = await listarMetasDoUsuario(A, wsSobra, hoje)
      expect(lista.map((m) => m.nome)).toEqual(['Reserva de emergência', 'Cadeira'])
      const r = lista[0]
      expect(r.guardado).toBe(280_000)
      expect(r.calculo).toEqual(
        calcularMeta({ alvo: 1_000_000, guardado: 280_000, dataAlvo: '2027-09-30', hoje, sobraMedia: 133_333 }),
      )
      // 9 meses (jan..set/27): faltam 720.000 -> 80.000/mês; sobra 133.333 -> no ritmo
      expect(r.calculo).toMatchObject({ mesesRestantes: 9, faltam: 720_000, necessarioPorMes: 80_000, sobraMedia: 133_333, situacao: 'no_ritmo' })
      expect(lista[1].calculo.situacao).toBe('concluida')

      // sem lançamentos nos meses fechados a sobra é 0: a mesma meta fica atrasada
      const semHistorico = await criarMetaDoUsuario(A, wsVazio, meta('Reserva de emergência', '10.000,00', '2027-09-30'))
      await registrarAporteDoUsuario(A, wsVazio, semHistorico.id, aporte('2.800,00'))
      const [v] = await listarMetasDoUsuario(A, wsVazio, hoje)
      expect(v.calculo).toMatchObject({ necessarioPorMes: 80_000, sobraMedia: 0, situacao: 'atrasada' })
    })
  })
})
