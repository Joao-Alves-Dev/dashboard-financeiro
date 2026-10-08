import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import { QTD_MESES_GRADE } from './grade'
import { listarGradeOrcamentoDoUsuario, type GradeOrcamento } from './servico'

export type { GradeOrcamento }

/** Categorias de despesa × `qtdMeses` meses a partir de `mesInicial` ('YYYY-MM-01'), com orçado e realizado. */
export async function listarGradeOrcamento(
  ws: string,
  mesInicial: string,
  qtdMeses: number = QTD_MESES_GRADE,
): Promise<GradeOrcamento> {
  const u = await exigirUsuario()
  return listarGradeOrcamentoDoUsuario(u.id, ws, mesInicial, qtdMeses)
}
