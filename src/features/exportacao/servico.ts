import 'server-only'
import { and, asc, desc, eq, gt, gte, lt, lte, sql, type SQL } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { lancamentos } from '@/db/schema'
import { normalizarFavorecido } from '@/features/favorecido/normalizar'
import { ErroDominio } from '@/lib/erro-dominio'
import type { LancamentoExportavel, TipoExportacao } from './relatorio'

/** Máximo de linhas de uma exportação (a lista é uma imagem para ler no celular, não um extrato). */
export const TETO_EXPORTACAO = 2000

export type ParamsExportacao = {
  /** Nome digitado ou chave; vazio/ausente = todos. Comparado por `normalizarFavorecido`. */
  favorecidoChave?: string
  de: string
  ate: string
  tipo: TipoExportacao
  /** Sem filtro de data ("exporte tudo do Roberto"): `de`/`ate` são ignorados. */
  todoPeriodo?: boolean
}

export type ResultadoExportacao = {
  itens: LancamentoExportavel[]
  /** Grafia mais recente do favorecido no workspace (qualquer período); null se não há ou se "todos". */
  nome: string | null
  /** O favorecido pedido tem algum lançamento no workspace (em qualquer período/status). */
  existe: boolean
}

/**
 * Lançamentos para a lista exportada: período inclusivo, sem paginação, por data crescente e depois
 * criação. SÓ efetivados: pendentes ainda não são "transações efetuadas". Acima do teto, erro amigável.
 */
export async function listarLancamentosParaExportarDoUsuario(
  userId: string,
  ws: string,
  p: ParamsExportacao,
  teto: number = TETO_EXPORTACAO,
): Promise<ResultadoExportacao> {
  const chave = normalizarFavorecido(p.favorecidoChave ?? '')
  const filtraFavorecido = (p.favorecidoChave ?? '').trim() !== ''
  const condicoes: (SQL | undefined)[] = [
    eq(lancamentos.workspaceId, ws),
    eq(lancamentos.status, 'efetivado'),
  ]
  if (!p.todoPeriodo) condicoes.push(gte(lancamentos.data, p.de), lte(lancamentos.data, p.ate))
  if (filtraFavorecido) {
    // Só um tratamento ("senhor") dá chave vazia: não casa com nada em vez de virar "todos".
    condicoes.push(chave ? eq(lancamentos.favorecidoChave, chave) : sql`false`)
  }
  if (p.tipo === 'saidas') condicoes.push(lt(lancamentos.valorCentavos, 0))
  else if (p.tipo === 'entradas') condicoes.push(gt(lancamentos.valorCentavos, 0))

  return comUsuario(userId, async (tx) => {
    const linhas = await tx
      .select({ data: lancamentos.data, descricao: lancamentos.descricao, valorCentavos: lancamentos.valorCentavos })
      .from(lancamentos)
      .where(and(...condicoes))
      .orderBy(asc(lancamentos.data), asc(lancamentos.criadoEm), asc(lancamentos.id))
      .limit(teto + 1)
    if (linhas.length > teto) throw new ErroDominio('exportacao.muitos', { max: teto })

    let nome: string | null = null
    let existe = false
    if (filtraFavorecido && chave) {
      const [recente] = await tx
        .select({ favorecido: lancamentos.favorecido })
        .from(lancamentos)
        .where(and(eq(lancamentos.workspaceId, ws), eq(lancamentos.favorecidoChave, chave)))
        .orderBy(desc(lancamentos.data), desc(lancamentos.criadoEm), desc(lancamentos.id))
        .limit(1)
      nome = recente?.favorecido ?? null
      existe = recente !== undefined
    }
    return { itens: linhas.map((l) => ({ data: l.data, descricao: l.descricao, valorCentavos: Number(l.valorCentavos) })), nome, existe }
  })
}
