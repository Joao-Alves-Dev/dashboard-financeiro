'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import type { ActionResult } from '@/lib/action-result'
import { ErroDominio } from '@/lib/erro-dominio'
import { executar, validarEntrada } from '@/lib/executar-action'
import { exigirUsuario } from '@/lib/sessao'
import { ehUuid } from '@/lib/uuid'
import { confirmarSchema, mapeamentoSchema, validarArquivoUpload } from './schemas'
import {
  confirmarImportacaoDoUsuario,
  desfazerImportacaoDoUsuario,
  previaImportacaoDoUsuario,
  type Previa,
  type ResultadoImportacao,
} from './servico'

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v : ''
}

/**
 * Campos: workspaceId, contaId, arquivo (File) e, para CSV, colData/colDescricao/colValor/inverterSinal.
 * Tamanho e extensão são validados aqui; nada vindo do navegador é confiável.
 */
export async function previaImportacao(fd: FormData): Promise<ActionResult<Previa>> {
  const u = await exigirUsuario()
  return executar(async () => {
    const workspaceId = texto(fd, 'workspaceId')
    const contaId = texto(fd, 'contaId')
    if (!ehUuid(workspaceId)) throw new ErroDominio('comum.semAcesso')
    if (!ehUuid(contaId)) throw new ErroDominio('importacao.erros.contaNaoEncontrada')

    const arquivo = fd.get('arquivo')
    if (!(arquivo instanceof File)) throw new ErroDominio('importacao.erros.semArquivo')
    const v = validarArquivoUpload(arquivo.name, arquivo.size)
    if (!v.ok) throw new ErroDominio(v.chave)

    let mapeamento = null
    if (texto(fd, 'colData') || texto(fd, 'colDescricao') || texto(fd, 'colValor')) {
      const p = mapeamentoSchema.safeParse({
        colData: texto(fd, 'colData'),
        colDescricao: texto(fd, 'colDescricao'),
        colValor: texto(fd, 'colValor'),
        inverterSinal: texto(fd, 'inverterSinal') === 'true',
      })
      if (!p.success) throw new ErroDominio('importacao.erros.mapeamentoInvalido')
      mapeamento = p.data
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    return previaImportacaoDoUsuario(u.id, workspaceId, contaId, { bytes, extensao: v.extensao }, mapeamento)
  })
}

/**
 * Só as linhas que o usuário marcou (sem duplicadas). Tudo é revalidado com Zod e de novo no SQL;
 * duplicadas que escaparem são ignoradas pelo `on conflict`.
 */
export async function confirmarImportacao(
  workspaceId: string,
  contaId: string,
  arquivo: string,
  formato: string,
  linhas: unknown[],
  mapeamento?: unknown,
): Promise<ActionResult<{ inseridos: number; ignorados: number }>> {
  const u = await exigirUsuario()
  const v = await validarEntrada(confirmarSchema, { workspaceId, contaId, arquivo, formato, linhas, mapeamento })
  if (!v.ok) {
    return { ok: false, erro: (await getTranslations())('importacao.erros.dadosInvalidos') }
  }
  const r = await executar<ResultadoImportacao>(() => confirmarImportacaoDoUsuario(u.id, v.data))
  if (!r.ok) return r
  revalidatePath(`/w/${workspaceId}`, 'layout')
  return { ok: true, data: { inseridos: r.data.inseridos, ignorados: r.data.ignorados } }
}

export async function desfazerImportacao(workspaceId: string, importacaoId: string): Promise<ActionResult<null>> {
  const u = await exigirUsuario()
  const r = await executar(async () => {
    if (!ehUuid(workspaceId) || !ehUuid(importacaoId)) throw new ErroDominio('importacao.erros.importacaoNaoEncontrada')
    await desfazerImportacaoDoUsuario(u.id, workspaceId, importacaoId)
    return null
  })
  if (r.ok) revalidatePath(`/w/${workspaceId}`, 'layout')
  return r
}
