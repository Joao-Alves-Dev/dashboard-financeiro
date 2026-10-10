import 'server-only'
import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { contas, lancamentos } from '@/db/schema'
import { inicioDoMes, ultimoDiaDoMes } from '@/features/dashboard/periodo'
import {
  gastosPorCategoriaDoUsuario,
  orcamentoVsRealizadoDoUsuario,
  resumoMensalDoUsuario,
} from '@/features/dashboard/servico'
import { MESES_SOBRA_MEDIA, mesesFechados } from '@/features/metas/sobra-media'
import { listarMetasDoUsuario } from '@/features/metas/servico'
import type { ContextoFinanceiro } from './tipos'

/** Saídas efetivadas do período em contas tipo `cartao` (valor positivo). */
async function gastoCartaoDoUsuario(userId: string, ws: string, de: string, ate: string): Promise<number> {
  const [r] = await comUsuario(userId, (tx) =>
    tx
      .select({ total: sql<string>`coalesce(sum(-${lancamentos.valorCentavos}), 0)::text` })
      .from(lancamentos)
      .innerJoin(contas, and(eq(contas.id, lancamentos.contaId), eq(contas.workspaceId, lancamentos.workspaceId)))
      .where(
        and(
          eq(lancamentos.workspaceId, ws),
          eq(contas.tipo, 'cartao'),
          eq(lancamentos.status, 'efetivado'),
          sql`${lancamentos.valorCentavos} < 0`,
          gte(lancamentos.data, de),
          lte(lancamentos.data, ate),
        ),
      ),
  )
  return Number(r?.total ?? 0)
}

/**
 * Foto financeira do mês de `hoje` para o motor de regras (tudo em centavos), reutilizando as funções SQL do
 * dashboard e `listarMetas`:
 *  - renda = entradas efetivadas do mês corrente; saídas = saídas efetivadas do mês corrente;
 *  - gasto por categoria do mês e MÉDIA dos 3 meses FECHADOS anteriores: total do período / 3, arredondado ao
 *    centavo mais próximo, de modo que meses sem gasto contam 0 (mesma janela da sobra média das metas);
 *  - gastos "Sem categoria" ficam de fora: não há instância para dispensar nem orientar;
 *  - orçamentos: só categorias com orçamento no mês (orçado > 0);
 *  - cartão: saídas efetivadas do mês em contas tipo cartão;
 *  - resultados: entradas - saídas de cada um dos 3 meses fechados (mês vazio = 0).
 * Meses fechados cruzam a virada de ano normalmente (hoje 2027-01-10 -> out, nov e dez de 2026).
 */
export async function montarContextoDoUsuario(userId: string, ws: string, hoje: string): Promise<ContextoFinanceiro> {
  const mes = inicioDoMes(hoje)
  const fimMes = ultimoDiaDoMes(hoje)
  const { de, ate } = mesesFechados(hoje)

  const [resumoMes, resumoFechados, gastosMes, gastosFechados, orcamentos, metas, gastoCartaoMes] = await Promise.all([
    resumoMensalDoUsuario(userId, ws, mes, fimMes),
    resumoMensalDoUsuario(userId, ws, de, ate),
    gastosPorCategoriaDoUsuario(userId, ws, mes, fimMes),
    gastosPorCategoriaDoUsuario(userId, ws, de, ate),
    orcamentoVsRealizadoDoUsuario(userId, ws, mes),
    listarMetasDoUsuario(userId, ws, hoje),
    gastoCartaoDoUsuario(userId, ws, mes, fimMes),
  ])

  const doMes = resumoMes.find((l) => l.mes === mes)
  const nomes = new Map<string, string>()
  const gasto = new Map<string, number>()
  const media = new Map<string, number>()
  for (const g of gastosFechados) {
    if (g.categoriaId === null) continue
    nomes.set(g.categoriaId, g.nome)
    media.set(g.categoriaId, Math.round(g.total / MESES_SOBRA_MEDIA))
  }
  for (const g of gastosMes) {
    if (g.categoriaId === null) continue
    nomes.set(g.categoriaId, g.nome)
    gasto.set(g.categoriaId, g.total)
  }

  return {
    hoje,
    diaDoMes: Number(hoje.slice(8, 10)),
    diasNoMes: Number(fimMes.slice(8, 10)),
    rendaMes: doMes?.entradas ?? 0,
    saidasMes: doMes?.saidas ?? 0,
    categorias: [...nomes].map(([id, nome]) => ({
      id,
      nome,
      gastoMes: gasto.get(id) ?? 0,
      mediaTresMeses: media.get(id) ?? 0,
    })),
    orcamentos: orcamentos
      .filter((o) => o.orcado > 0)
      .map((o) => ({ categoriaId: o.categoriaId, nome: o.nome, orcado: o.orcado, realizado: o.realizado })),
    metas: metas.map((m) => ({
      id: m.id,
      nome: m.nome,
      situacao: m.calculo.situacao,
      necessarioPorMes: m.calculo.necessarioPorMes,
      sobraMedia: m.calculo.sobraMedia,
    })),
    gastoCartaoMes,
    resultadosTresMeses: resumoFechados.map((l) => l.resultado),
  }
}
