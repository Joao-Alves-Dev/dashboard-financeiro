'use server'

import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { exportacaoSchema, type ExportacaoInput } from './schemas'
import { listarLancamentosParaExportarDoUsuario, type ResultadoExportacao } from './servico'

/**
 * Busca (somente leitura) os lançamentos efetivados do período/favorecido para montar a lista no
 * navegador. Usada pela tela de exportação e pela voz; nada é gravado nem enviado a terceiros.
 */
export async function buscarLancamentosParaExportar(
  workspaceId: string,
  input: ExportacaoInput,
): Promise<ActionResult<ResultadoExportacao>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(exportacaoSchema, input)
  if (!v.ok) return v.resultado
  return executar(async () => {
    if (!ehUuid(workspaceId)) throw new ErroDominio('lancamentos.naoEncontrado')
    return listarLancamentosParaExportarDoUsuario(u.id, workspaceId, {
      favorecidoChave: v.data.favorecido,
      de: v.data.de,
      ate: v.data.ate,
      tipo: v.data.tipo,
      todoPeriodo: v.data.todoPeriodo,
    })
  })
}
