import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { alertasDispensados, lancamentos, orcamentos } from '@/db/schema'
import { contaSchema } from '@/features/config/schemas'
import { criarContaDoUsuario, listarCategoriasDoUsuario } from '@/features/config/servico'
import { criarMetaDoUsuario } from '@/features/metas/servico'
import { metaSchema } from '@/features/metas/schemas'
import { configSchema, dispensarSchema } from '@/features/orientador/schemas'
import {
  carregarConfigDoUsuario,
  dispensarAlertaDoUsuario,
  listarAlertasDoUsuario,
  montarContexto,
  restaurarConfigDoUsuario,
  salvarConfigDoUsuario,
} from '@/features/orientador/servico'
import { REGRAS_IDS } from '@/features/orientador/regras'
import { codigoPg } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (e) {
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

const HOJE = '2027-01-10' // dia 10 de 31; meses fechados: out, nov e dez de 2026 (virada de ano)
const dispensa = (regraId: string, chave: string, severidade: string) =>
  dispensarSchema.parse({ regraId, chave, severidade })

describe('orientador (serviço)', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsVazio: string
  let wsB: string
  let cat: Record<string, string> = {}

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsVazio = await novoWorkspace(A, 'Vazio')
      wsB = await novoWorkspace(B, 'Casa B')

      const corrente = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente' }))).id
      const cartao = (await criarContaDoUsuario(A, wsA, contaSchema.parse({ nome: 'Cartão', tipo: 'cartao' }))).id
      cat = Object.fromEntries((await listarCategoriasDoUsuario(A, wsA)).map((c) => [c.nome, c.id]))

      const lanca = (conta: string, data: string, valor: number, categoria: string | null, status: 'efetivado' | 'pendente' = 'efetivado') =>
        comUsuario(A, (tx) =>
          tx.insert(lancamentos).values({
            workspaceId: wsA,
            contaId: conta,
            categoriaId: categoria ? cat[categoria] : null,
            data,
            descricao: 'x',
            valorCentavos: valor,
            status,
          }),
        )

      // Meses fechados (resultados 220.000, 250.000, 450.000; Alimentação só em out; nov/dez sem gasto = 0)
      await lanca(corrente, '2026-10-01', 300_000, 'Salário')
      await lanca(corrente, '2026-10-05', -50_000, 'Moradia')
      await lanca(corrente, '2026-10-20', -30_000, 'Alimentação')
      await lanca(corrente, '2026-11-01', 300_000, 'Salário')
      await lanca(corrente, '2026-11-05', -50_000, 'Moradia')
      await lanca(corrente, '2026-12-01', 500_000, 'Salário')
      await lanca(corrente, '2026-12-31', -50_000, 'Moradia') // virada de ano: dezembro
      // Fora da janela / ignorados
      await lanca(corrente, '2026-09-30', -99_999, 'Alimentação') // antes dos 3 meses
      await lanca(corrente, '2026-12-15', -77_777, 'Lazer', 'pendente') // pendente
      // Mês corrente (janeiro de 2027)
      await lanca(corrente, '2027-01-01', 1, null) // 1 centavo de entrada sem categoria (virada de ano)
      await lanca(corrente, '2027-01-02', 499_999, 'Salário') // total de renda: 500.000
      await lanca(corrente, '2027-01-05', -200_000, 'Moradia')
      await lanca(corrente, '2027-01-08', -14_100, 'Alimentação')
      await lanca(cartao, '2027-01-09', -160_000, 'Lazer')
      await lanca(corrente, '2027-01-09', -1_000, null) // sem categoria: conta na saída, não vira categoria
      await lanca(corrente, '2027-02-01', -888_888, 'Moradia') // mês seguinte: fora

      await comUsuario(A, (tx) =>
        tx.insert(orcamentos).values([
          { workspaceId: wsA, categoriaId: cat['Alimentação'], mes: '2027-01-01', valorCentavos: 16_000 }, // 88%
          { workspaceId: wsA, categoriaId: cat['Lazer'], mes: '2027-01-01', valorCentavos: 160_000 }, // 100%
          { workspaceId: wsA, categoriaId: cat['Transporte'], mes: '2027-01-01', valorCentavos: 0 }, // sem orçamento
        ]),
      )
      await criarMetaDoUsuario(A, wsA, metaSchema.parse({ nome: 'Viagem', valorAlvo: '10000,00', dataAlvo: '31/03/2027' }))
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  describe('montarContexto', () => {
    it('renda, saídas, dia e dias do mês do mês corrente', async () => {
      const c = await montarContexto(A, wsA, HOJE)
      expect(c).toMatchObject({ hoje: HOJE, diaDoMes: 10, diasNoMes: 31, rendaMes: 500_000, saidasMes: 375_100 })
    })

    it('gasto do mês e média dos 3 meses fechados (meses sem gasto contam 0; virada de ano; fora da janela ignorado)', async () => {
      const c = await montarContexto(A, wsA, HOJE)
      const por = Object.fromEntries(c.categorias.map((x) => [x.nome, x]))
      // Alimentação: só out (30.000) em 3 meses -> média 10.000; 99.999 de 30/09 fica de fora
      expect(por['Alimentação']).toMatchObject({ gastoMes: 14_100, mediaTresMeses: 10_000 })
      // Moradia: 50.000 em cada mês fechado (31/12 incluso) -> média 50.000
      expect(por['Moradia']).toMatchObject({ gastoMes: 200_000, mediaTresMeses: 50_000 })
      // Lazer: pendente de dezembro não conta; só janeiro
      expect(por['Lazer']).toMatchObject({ gastoMes: 160_000, mediaTresMeses: 0 })
      // "Sem categoria" e categorias sem gasto não aparecem
      expect(c.categorias.map((x) => x.nome).sort()).toEqual(['Alimentação', 'Lazer', 'Moradia'])
    })

    it('orçamento do mês (só orçado > 0), metas com situação e cartão', async () => {
      const c = await montarContexto(A, wsA, HOJE)
      expect(c.orcamentos.map((o) => [o.nome, o.orcado, o.realizado]).sort()).toEqual([
        ['Alimentação', 16_000, 14_100],
        ['Lazer', 160_000, 160_000],
      ])
      // sobra média = (220.000 + 250.000 + 450.000) / 3 = 306.667; necessário = 1.000.000 / 3 meses = 333.334
      expect(c.metas).toEqual([
        { id: expect.any(String), nome: 'Viagem', situacao: 'atrasada', necessarioPorMes: 333_334, sobraMedia: 306_667 },
      ])
      expect(c.gastoCartaoMes).toBe(160_000)
    })

    it('resultados dos 3 meses fechados em ordem cronológica', async () => {
      const c = await montarContexto(A, wsA, HOJE)
      expect(c.resultadosTresMeses).toEqual([220_000, 250_000, 450_000])
    })

    it('workspace vazio: tudo zero, 3 resultados zero', async () => {
      const c = await montarContexto(A, wsVazio, HOJE)
      expect(c).toMatchObject({
        rendaMes: 0,
        saidasMes: 0,
        categorias: [],
        orcamentos: [],
        metas: [],
        gastoCartaoMes: 0,
        resultadosTresMeses: [0, 0, 0],
      })
    })

    it('hoje inválido é rejeitado', async () => {
      await expect(montarContexto(A, wsA, '10/01/2027')).rejects.toThrow()
    })
  })

  describe('listarAlertas / dispensar', () => {
    it('dispara as 9 regras esperadas com os valores reais', async () => {
      const alertas = await listarAlertasDoUsuario(A, wsA, HOJE)
      expect([...new Set(alertas.map((a) => a.regraId))].sort()).toEqual([...REGRAS_IDS].sort())
      // ordenação: críticos primeiro, positivo por último
      const ordem = ['critico', 'atencao', 'info', 'positivo']
      const idx = alertas.map((a) => ordem.indexOf(a.severidade))
      expect(idx).toEqual([...idx].sort((x, y) => x - y))
      const moradia = alertas.find((a) => a.regraId === 'categoria-pct-renda' && a.chave === cat['Moradia'])
      expect(moradia?.texto).toContain('40%')
      expect(moradia?.texto).toContain('2.000,00')
      expect(alertas.find((a) => a.regraId === 'cartao-alto')?.texto).toContain('32%')
      expect(alertas.find((a) => a.regraId === 'orcamento-100')?.chave).toBe(cat['Lazer'])
      expect(alertas.find((a) => a.regraId === 'orcamento-80')?.chave).toBe(cat['Alimentação'])
      expect(alertas.find((a) => a.regraId === 'meta-atrasada')?.texto).toContain('3.333,34')
    })

    it('dispensar some no mês corrente e reaparece com severidade maior', async () => {
      // mes-negativo está critico: dispensar com severidade menor NÃO esconde
      await dispensarAlertaDoUsuario(A, wsA, dispensa('mes-negativo', '', 'atencao'), HOJE)
      expect((await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)).toContain('mes-negativo')
      // dispensar na severidade atual esconde (também em outro dia do mesmo mês)
      await dispensarAlertaDoUsuario(A, wsA, dispensa('mes-negativo', '', 'critico'), HOJE)
      expect((await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)).not.toContain('mes-negativo')
      expect((await listarAlertasDoUsuario(A, wsA, '2027-01-25')).map((a) => a.regraId)).not.toContain('mes-negativo')
      // só aquela instância: outras ficam
      expect((await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)).toContain('cartao-alto')
    })

    it('dispensar duas vezes não duplica (upsert) e atualiza a severidade gravada', async () => {
      await dispensarAlertaDoUsuario(A, wsA, dispensa('sem-reserva', '', 'info'), HOJE)
      await dispensarAlertaDoUsuario(A, wsA, dispensa('sem-reserva', '', 'critico'), HOJE)
      const linhas = await comUsuario(A, (tx) =>
        tx.select().from(alertasDispensados).where(eq(alertasDispensados.regraId, 'sem-reserva')),
      )
      expect(linhas).toHaveLength(1)
      expect(linhas[0]).toMatchObject({ severidade: 'critico', mes: '2027-01-01', chave: '' })
    })

    it('a dispensa de janeiro não vale em fevereiro (alerta global volta)', async () => {
      expect((await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)).not.toContain('sem-reserva')
      expect((await listarAlertasDoUsuario(A, wsA, '2027-02-10')).map((a) => a.regraId)).toContain('sem-reserva')
    })

    it('dispensa por instância: dispensar uma categoria não esconde a outra', async () => {
      await dispensarAlertaDoUsuario(A, wsA, dispensa('categoria-pct-renda', cat['Moradia'], 'atencao'), HOJE)
      const r = (await listarAlertasDoUsuario(A, wsA, HOJE)).filter((a) => a.regraId === 'categoria-pct-renda')
      expect(r.map((a) => a.chave)).toEqual([cat['Lazer']])
    })

    it('entradas inválidas são recusadas pelo schema (regra desconhecida, severidade, chave longa)', () => {
      expect(dispensarSchema.safeParse({ regraId: 'inventada', chave: '', severidade: 'critico' }).success).toBe(false)
      expect(dispensarSchema.safeParse({ regraId: 'cartao-alto', chave: '', severidade: 'x' }).success).toBe(false)
    })

    it('workspace vazio: só o lembrete de reserva', async () => {
      expect((await listarAlertasDoUsuario(A, wsVazio, HOJE)).map((a) => a.regraId)).toEqual(['sem-reserva'])
    })
  })

  describe('configuração', () => {
    it('sem linha: padrões 15/30/30; salvar persiste e altera os alertas; restaurar volta aos padrões', async () => {
      expect(await carregarConfigDoUsuario(A, wsA)).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })

      const salvo = await salvarConfigDoUsuario(A, wsA, configSchema.parse({ limiteCategoriaPct: '50', altaPct: '500', cartaoPct: '40' }))
      expect(salvo).toEqual({ limiteCategoriaPct: 50, altaPct: 500, cartaoPct: 40 })
      expect(await carregarConfigDoUsuario(A, wsA)).toEqual(salvo)
      // salvar de novo (upsert) funciona
      await salvarConfigDoUsuario(A, wsA, configSchema.parse({ limiteCategoriaPct: '50', altaPct: '500', cartaoPct: '40' }))

      const regras = (await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)
      expect(regras).not.toContain('categoria-pct-renda') // 40% e 32% < 50%
      expect(regras).not.toContain('cartao-alto') // 32% < 40%
      expect(regras).not.toContain('categoria-alta') // nada passa de +500%

      expect(await restaurarConfigDoUsuario(A, wsA)).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })
      expect(await carregarConfigDoUsuario(A, wsA)).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })
      expect((await listarAlertasDoUsuario(A, wsA, HOJE)).map((a) => a.regraId)).toContain('cartao-alto')
    })

    it('limites inválidos são rejeitados (schema) e o banco também rejeita (23514)', async () => {
      for (const [l, a, c] of [['0', '30', '30'], ['101', '30', '30'], ['15', '0', '30'], ['15', '501', '30'], ['15', '30', '101'], ['x', '30', '30']]) {
        expect(configSchema.safeParse({ limiteCategoriaPct: l, altaPct: a, cartaoPct: c }).success, `${l}/${a}/${c}`).toBe(false)
      }
      expect(await codigoDe(salvarConfigDoUsuario(A, wsA, { limiteCategoriaPct: 0, altaPct: 30, cartaoPct: 30 }))).toBe('23514')
      expect(await carregarConfigDoUsuario(A, wsA)).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })
    })
  })

  describe('isolamento', () => {
    it('B não monta contexto, não lista, não dispensa nem configura o workspace de A (42501)', async () => {
      expect(await codigoDe(montarContexto(B, wsA, HOJE))).toBe('42501')
      expect(await codigoDe(listarAlertasDoUsuario(B, wsA, HOJE))).toBe('42501')
      expect(await codigoDe(dispensarAlertaDoUsuario(B, wsA, dispensa('cartao-alto', '', 'atencao'), HOJE))).toBe('42501')
      expect(await codigoDe(carregarConfigDoUsuario(B, wsA))).toBe('42501')
      expect(await codigoDe(salvarConfigDoUsuario(B, wsA, { limiteCategoriaPct: 99, altaPct: 99, cartaoPct: 99 }))).toBe('42501')
      expect(await codigoDe(restaurarConfigDoUsuario(B, wsA))).toBe('42501')
    })

    it('workspace inexistente ou id inválido também falha; os dados de A seguem intactos', async () => {
      expect(await codigoDe(listarAlertasDoUsuario(B, 'nao-e-uuid', HOJE))).toBe('outro:comum.semAcesso')
      expect(await carregarConfigDoUsuario(A, wsA)).toEqual({ limiteCategoriaPct: 15, altaPct: 30, cartaoPct: 30 })
      // as dispensas de A (feitas nos testes acima) continuam e B não vê nenhuma
      expect((await comUsuario(A, (tx) => tx.select().from(alertasDispensados))).length).toBeGreaterThan(0)
      expect(await comUsuario(B, (tx) => tx.select().from(alertasDispensados))).toEqual([])
    })

    it('B opera normalmente no próprio workspace', async () => {
      expect((await listarAlertasDoUsuario(B, wsB, HOJE)).map((a) => a.regraId)).toEqual(['sem-reserva'])
      await dispensarAlertaDoUsuario(B, wsB, dispensa('sem-reserva', '', 'info'), HOJE)
      expect(await listarAlertasDoUsuario(B, wsB, HOJE)).toEqual([])
    })
  })
})
