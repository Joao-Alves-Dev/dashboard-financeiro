import 'server-only'
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import { comUsuario, type Tx } from '@/db/com-usuario'
import { categorias, orcamentos } from '@/db/schema'
import { mesAnterior, ultimoDiaDoMes } from '@/features/dashboard/periodo'
import { ErroDominio } from '@/lib/erro-dominio'
import { ehUuid } from '@/lib/uuid'
import {
  calcularTotais,
  interpretarValorOrcamento,
  mesesConsecutivos,
  normalizarMes,
  QTD_MESES_GRADE,
  type LinhaGrade,
  type TotalMes,
} from './grade'

/**
 * Camada de orçamento por userId (testável sem headers do Next). Tudo passa por `comUsuario`; Drizzle puro,
 * sem função SQL nova: cada operação cabe numa transação simples e o RLS + a FK composta
 * (workspace_id, categoria_id) já garantem o isolamento.
 *
 * Contrato de sinais: o orçado e o realizado são >= 0 (despesa em valor POSITIVO), como em
 * `orcamento_vs_realizado` (db/migrations/0007_dashboard.sql): só lançamentos `efetivado`, saídas
 * (valor < 0) com categoria, agrupados pelo mês de `data` (tipo date, sem fuso).
 *
 * `orcado = null` = sem orçamento; `orcado = 0` = orçamento zero gravado ("não gastar nada").
 */

export type GradeOrcamento = {
  meses: string[]
  linhas: LinhaGrade[]
  totais: TotalMes[]
}

/** Falha com 42501 (sem acesso) se o usuário não é membro do workspace; mesma checagem das funções do dashboard. */
async function exigirMembro(tx: Tx, ws: string): Promise<void> {
  if (!ehUuid(ws)) throw new ErroDominio('comum.semAcesso')
  await tx.execute(sql`select public.exigir_membro(${ws}::uuid)`)
}

function exigirMes(mes: string): string {
  const m = normalizarMes(mes)
  if (!m) throw new ErroDominio('orcamento.mesInvalido')
  return m
}

export async function listarGradeOrcamentoDoUsuario(
  userId: string,
  ws: string,
  mesInicial: string,
  qtdMeses: number = QTD_MESES_GRADE,
): Promise<GradeOrcamento> {
  const inicio = exigirMes(mesInicial)
  const qtd = Math.min(Math.max(1, Math.trunc(qtdMeses)), 24)
  const meses = mesesConsecutivos(inicio, qtd)
  const fim = ultimoDiaDoMes(meses[meses.length - 1])

  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)

    const cats = await tx
      .select({ id: categorias.id, nome: categorias.nome, cor: categorias.cor })
      .from(categorias)
      .where(and(eq(categorias.workspaceId, ws), eq(categorias.natureza, 'despesa')))
      .orderBy(asc(categorias.nome), asc(categorias.id))

    const orcados = await tx
      .select({ categoriaId: orcamentos.categoriaId, mes: orcamentos.mes, valor: orcamentos.valorCentavos })
      .from(orcamentos)
      .where(and(eq(orcamentos.workspaceId, ws), gte(orcamentos.mes, inicio), lte(orcamentos.mes, fim)))

    // Uma única agregação para todos os meses/categorias (sem N+1). `data` é date: trunc por timestamp
    // sem fuso, igual às funções do dashboard.
    const gastos = await tx.execute(
      sql`select l.categoria_id::text as categoria_id,
                 date_trunc('month', l.data::timestamp)::date::text as mes,
                 sum(-l.valor_centavos)::text as total
          from lancamentos l
          where l.workspace_id = ${ws}::uuid
            and l.status = 'efetivado'
            and l.valor_centavos < 0
            and l.categoria_id is not null
            and l.data >= ${inicio}::date
            and l.data <= ${fim}::date
          group by 1, 2`,
    )

    const orcPor = new Map(orcados.map((o) => [`${o.categoriaId}|${o.mes}`, Number(o.valor)]))
    const gastoPor = new Map(
      (gastos.rows as { categoria_id: string; mes: string; total: string }[]).map((g) => [
        `${g.categoria_id}|${g.mes}`,
        Number(g.total),
      ]),
    )

    const linhas: LinhaGrade[] = cats.map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      cor: c.cor,
      celulas: meses.map((mes) => ({
        mes,
        orcado: orcPor.get(`${c.id}|${mes}`) ?? null,
        realizado: gastoPor.get(`${c.id}|${mes}`) ?? 0,
      })),
    }))
    return { meses, linhas, totais: calcularTotais(linhas, meses) }
  })
}

/**
 * Upsert do orçamento da categoria no mês. `valor` vazio apaga; "0" grava orçamento 0 (diferente de apagar);
 * negativo/ inválido rejeita. `mes` é normalizado para o dia 1. A categoria precisa ser `despesa` do workspace.
 */
export async function salvarOrcamentoDoUsuario(
  userId: string,
  ws: string,
  categoriaId: string,
  mes: string,
  valor: string,
): Promise<void> {
  const mesNorm = exigirMes(mes)
  const v = interpretarValorOrcamento(valor)
  if (v.tipo === 'erro') {
    throw new ErroDominio(
      v.motivo === 'negativo' ? 'orcamento.valorNegativo' : v.motivo === 'grande' ? 'orcamento.valorGrande' : 'orcamento.valorInvalido',
    )
  }
  if (!ehUuid(categoriaId)) throw new ErroDominio('orcamento.categoriaInvalida')

  await comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const [cat] = await tx
      .select({ id: categorias.id })
      .from(categorias)
      .where(and(eq(categorias.id, categoriaId), eq(categorias.workspaceId, ws), eq(categorias.natureza, 'despesa')))
    if (!cat) throw new ErroDominio('orcamento.categoriaInvalida')

    if (v.tipo === 'apagar') {
      await tx
        .delete(orcamentos)
        .where(and(eq(orcamentos.workspaceId, ws), eq(orcamentos.categoriaId, categoriaId), eq(orcamentos.mes, mesNorm)))
      return
    }
    await tx
      .insert(orcamentos)
      .values({ workspaceId: ws, categoriaId, mes: mesNorm, valorCentavos: v.centavos })
      .onConflictDoUpdate({ target: [orcamentos.categoriaId, orcamentos.mes], set: { valorCentavos: v.centavos } })
  })
}

/**
 * Copia os orçamentos do mês anterior para `mes` sem sobrescrever os que já existem
 * (`on conflict do nothing`). Devolve quantos foram de fato inseridos.
 */
export async function copiarMesAnteriorDoUsuario(
  userId: string,
  ws: string,
  mes: string,
): Promise<{ copiados: number }> {
  const mesNorm = exigirMes(mes)
  const anterior = mesAnterior(mesNorm)

  return comUsuario(userId, async (tx) => {
    await exigirMembro(tx, ws)
    const origem = await tx
      .select({ categoriaId: orcamentos.categoriaId, valor: orcamentos.valorCentavos })
      .from(orcamentos)
      .innerJoin(
        categorias,
        and(eq(categorias.id, orcamentos.categoriaId), eq(categorias.workspaceId, orcamentos.workspaceId)),
      )
      .where(and(eq(orcamentos.workspaceId, ws), eq(orcamentos.mes, anterior), eq(categorias.natureza, 'despesa')))
    if (origem.length === 0) return { copiados: 0 }
    const inseridos = await tx
      .insert(orcamentos)
      .values(origem.map((o) => ({ workspaceId: ws, categoriaId: o.categoriaId, mes: mesNorm, valorCentavos: o.valor })))
      .onConflictDoNothing()
      .returning({ categoriaId: orcamentos.categoriaId })
    return { copiados: inseridos.length }
  })
}
