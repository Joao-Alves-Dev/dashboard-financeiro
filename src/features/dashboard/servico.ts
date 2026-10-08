import 'server-only'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categorias, contas, lancamentos } from '@/db/schema'
import { variacaoPercentual } from './formatar'
import { inicioDoMes, mesAnterior, somarDias, ultimoDiaDoMes } from './periodo'
import type { GastoCategoria } from './agrupar'
import type { LinhaResumoMensal } from './serie'

/**
 * Camada de leitura do dashboard (por userId, testável sem headers do Next). Toda leitura passa por
 * `comUsuario`. As funções SQL devolvem bigint/numeric/date como texto: convertemos aqui (centavos cabem
 * em Number) e pedimos as datas já como texto (`::text`) para nunca passar por Date/fuso.
 *
 * Contrato de sinais (ver db/migrations/0007_dashboard.sql): entradas e saídas são >= 0 (saída em valor
 * POSITIVO), resultado = entradas - saídas; só lançamentos efetivados.
 */
const n = (v: unknown): number => Number(v ?? 0)

type Linha = Record<string, unknown>

export async function resumoMensalDoUsuario(
  userId: string,
  ws: string,
  de: string,
  ate: string,
): Promise<LinhaResumoMensal[]> {
  return comUsuario(userId, (tx) => resumoMensalTx(tx, ws, de, ate))
}

type TxLeitura = Pick<Parameters<Parameters<typeof comUsuario>[1]>[0], 'execute'>

async function resumoMensalTx(tx: TxLeitura, ws: string, de: string, ate: string): Promise<LinhaResumoMensal[]> {
  const r = await tx.execute(
    sql`select mes::text as mes, entradas::text as entradas, saidas::text as saidas, resultado::text as resultado
        from resumo_mensal(${ws}::uuid, ${de}::date, ${ate}::date)`,
  )
  return (r.rows as Linha[]).map((x) => ({
    mes: String(x.mes),
    entradas: n(x.entradas),
    saidas: n(x.saidas),
    resultado: n(x.resultado),
  }))
}

export async function gastosPorCategoriaDoUsuario(
  userId: string,
  ws: string,
  de: string,
  ate: string,
): Promise<GastoCategoria[]> {
  return comUsuario(userId, async (tx) => {
    const r = await tx.execute(
      sql`select categoria_id::text as categoria_id, nome, cor, total::text as total
          from gastos_por_categoria(${ws}::uuid, ${de}::date, ${ate}::date)`,
    )
    return (r.rows as Linha[]).map((x) => ({
      categoriaId: x.categoria_id === null ? null : String(x.categoria_id),
      nome: String(x.nome),
      cor: x.cor === null ? null : String(x.cor),
      total: n(x.total),
    }))
  })
}

export type LinhaOrcamento = {
  categoriaId: string
  nome: string
  orcado: number
  realizado: number
  /** realizado/orcado em %, nulo quando não há orçamento (orçado 0). */
  percentual: number | null
}

export async function orcamentoVsRealizadoDoUsuario(userId: string, ws: string, mes: string): Promise<LinhaOrcamento[]> {
  return comUsuario(userId, async (tx) => {
    const r = await tx.execute(
      sql`select categoria_id::text as categoria_id, nome, orcado::text as orcado, realizado::text as realizado,
                 percentual::text as percentual
          from orcamento_vs_realizado(${ws}::uuid, ${mes}::date)`,
    )
    return (r.rows as Linha[]).map((x) => ({
      categoriaId: String(x.categoria_id),
      nome: String(x.nome),
      orcado: n(x.orcado),
      realizado: n(x.realizado),
      percentual: x.percentual === null ? null : Number(x.percentual),
    }))
  })
}

export type TotaisMes = { entradas: number; saidas: number; resultado: number }
export type Kpis = {
  saldoAtual: number
  mes: TotaisMes
  anterior: TotaisMes
  /** Variação % sobre o mês anterior; nula quando o anterior é zero. */
  variacao: { entradas: number | null; saidas: number | null; resultado: number | null }
}

const ZERO: TotaisMes = { entradas: 0, saidas: 0, resultado: 0 }

/** `hoje` ('YYYY-MM-DD', America/Sao_Paulo) define o mês corrente e o anterior. */
export async function kpisDoUsuario(userId: string, ws: string, hoje: string): Promise<Kpis> {
  const mesAtual = inicioDoMes(hoje)
  const mesPrev = mesAnterior(hoje)
  return comUsuario(userId, async (tx) => {
    const s = await tx.execute(sql`select saldo_atual(${ws}::uuid)::text as saldo`)
    const linhas = await resumoMensalTx(tx, ws, mesPrev, ultimoDiaDoMes(hoje))
    const porMes = new Map(linhas.map((l) => [l.mes, l]))
    const pega = (m: string): TotaisMes => {
      const l = porMes.get(m)
      return l ? { entradas: l.entradas, saidas: l.saidas, resultado: l.resultado } : ZERO
    }
    const mes = pega(mesAtual)
    const anterior = pega(mesPrev)
    return {
      saldoAtual: n((s.rows[0] as Linha).saldo),
      mes,
      anterior,
      variacao: {
        entradas: variacaoPercentual(mes.entradas, anterior.entradas),
        saidas: variacaoPercentual(mes.saidas, anterior.saidas),
        resultado: variacaoPercentual(mes.resultado, anterior.resultado),
      },
    }
  })
}

export type LancamentoRecente = {
  id: string
  data: string
  descricao: string
  valorCentavos: number
  status: string
  categoriaNome: string | null
  contaNome: string
}

export async function ultimosLancamentosDoUsuario(userId: string, ws: string, limite: number): Promise<LancamentoRecente[]> {
  return comUsuario(userId, (tx) =>
    tx
      .select({
        id: lancamentos.id,
        data: lancamentos.data,
        descricao: lancamentos.descricao,
        valorCentavos: lancamentos.valorCentavos,
        status: lancamentos.status,
        categoriaNome: categorias.nome,
        contaNome: contas.nome,
      })
      .from(lancamentos)
      .innerJoin(contas, and(eq(contas.id, lancamentos.contaId), eq(contas.workspaceId, lancamentos.workspaceId)))
      .leftJoin(
        categorias,
        and(eq(categorias.id, lancamentos.categoriaId), eq(categorias.workspaceId, lancamentos.workspaceId)),
      )
      .where(eq(lancamentos.workspaceId, ws))
      .orderBy(desc(lancamentos.data), desc(lancamentos.criadoEm), desc(lancamentos.id))
      .limit(limite),
  )
}

export const JANELA_DIAS = 30
export const PROXIMOS_VENCIMENTOS = 5

export type Vencimento = { id: string; data: string; descricao: string; valorCentavos: number }
export type ContasAPagarReceber = {
  /** Soma de |valor| dos pendentes negativos na janela (positivo). */
  totalAPagar: number
  totalAReceber: number
  qtdAPagar: number
  qtdAReceber: number
  /** Próximos vencimentos (a pagar e a receber juntos), data crescente. */
  proximos: Vencimento[]
}

/**
 * Lançamentos `pendente` com data entre `hoje` e `hoje + 30 dias` (inclusivo). A janela é calculada por
 * aritmética de string (somarDias); vencidos (data < hoje) ficam de fora, conforme o spec.
 */
export async function contasAPagarReceberDoUsuario(userId: string, ws: string, hoje: string): Promise<ContasAPagarReceber> {
  const fim = somarDias(hoje, JANELA_DIAS)
  const where = and(
    eq(lancamentos.workspaceId, ws),
    eq(lancamentos.status, 'pendente'),
    gte(lancamentos.data, hoje),
    lte(lancamentos.data, fim),
  )
  return comUsuario(userId, async (tx) => {
    const [tot] = await tx
      .select({
        aPagar: sql<string>`coalesce(sum(case when ${lancamentos.valorCentavos} < 0 then -${lancamentos.valorCentavos} end), 0)::text`,
        aReceber: sql<string>`coalesce(sum(case when ${lancamentos.valorCentavos} > 0 then ${lancamentos.valorCentavos} end), 0)::text`,
        qtdAPagar: sql<string>`count(*) filter (where ${lancamentos.valorCentavos} < 0)::text`,
        qtdAReceber: sql<string>`count(*) filter (where ${lancamentos.valorCentavos} > 0)::text`,
      })
      .from(lancamentos)
      .where(where)
    const proximos = await tx
      .select({
        id: lancamentos.id,
        data: lancamentos.data,
        descricao: lancamentos.descricao,
        valorCentavos: lancamentos.valorCentavos,
      })
      .from(lancamentos)
      .where(where)
      .orderBy(asc(lancamentos.data), asc(lancamentos.criadoEm), asc(lancamentos.id))
      .limit(PROXIMOS_VENCIMENTOS)
    return {
      totalAPagar: n(tot.aPagar),
      totalAReceber: n(tot.aReceber),
      qtdAPagar: n(tot.qtdAPagar),
      qtdAReceber: n(tot.qtdAReceber),
      proximos,
    }
  })
}
