import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { comUsuario, type Tx } from '@/db/com-usuario'
import { contas, importacoes, lancamentos, regrasCategoria } from '@/db/schema'
import { codigoPg, ErroDominio } from '@/lib/erro-dominio'
import { aplicarRegras } from './aplicar-regras'
import { prepararArquivo } from './preparar'
import { mapeamentoSchema, type ConfirmarInput, type Formato } from './schemas'
import type { ErroLinha, LinhaImportada, MapeamentoCsv } from './tipos'

export type LinhaPrevia = LinhaImportada & {
  idExterno: string
  categoriaId: string | null
  duplicado: boolean
}

export type Previa = {
  formato: Formato
  linhas: LinhaPrevia[]
  erros: ErroLinha[]
  /** CSV: colunas do cabeçalho (sempre presentes em CSV, para a tela de mapeamento). */
  colunasCsv?: string[]
  /** CSV: mapeamento salvo na conta, só se todas as colunas existem neste arquivo. */
  mapeamentoSalvo?: MapeamentoCsv | null
  /** CSV sem mapeamento informado: ainda não há prévia, só colunas. */
  precisaMapeamento?: boolean
}

export type ResultadoImportacao = { importacaoId: string | null; inseridos: number; ignorados: number }

export type ItemHistorico = {
  id: string
  arquivoNome: string
  formato: string
  qtdLancamentos: number
  criadoEm: string
  contaNome: string
}

async function buscarConta(tx: Tx, ws: string, contaId: string) {
  const [c] = await tx
    .select({ id: contas.id, mapeamentoCsv: contas.mapeamentoCsv })
    .from(contas)
    .where(and(eq(contas.id, contaId), eq(contas.workspaceId, ws)))
  if (!c) throw new ErroDominio('importacao.erros.contaNaoEncontrada')
  return c
}

/** Mapeamento salvo na conta, se válido e se as colunas existem no arquivo atual. */
function mapeamentoUtilizavel(salvo: unknown, colunas: string[]): MapeamentoCsv | null {
  const p = mapeamentoSchema.safeParse(salvo)
  if (!p.success) return null
  const m = p.data
  return [m.colData, m.colDescricao, m.colValor].every((c) => colunas.includes(c)) ? m : null
}

export async function previaImportacaoDoUsuario(
  userId: string,
  ws: string,
  contaId: string,
  arquivo: { bytes: Uint8Array; extensao: Formato },
  mapeamento: MapeamentoCsv | null,
): Promise<Previa> {
  return comUsuario(userId, async (tx) => {
    const conta = await buscarConta(tx, ws, contaId)
    const prep = prepararArquivo(arquivo.bytes, arquivo.extensao, mapeamento)

    if (prep.tipo === 'precisa_mapeamento') {
      return {
        formato: 'csv',
        linhas: [],
        erros: [],
        colunasCsv: prep.colunas,
        mapeamentoSalvo: mapeamentoUtilizavel(conta.mapeamentoCsv, prep.colunas),
        precisaMapeamento: true,
      }
    }

    const regras = await tx
      .select({
        padrao: regrasCategoria.padrao,
        categoriaId: regrasCategoria.categoriaId,
        prioridade: regrasCategoria.prioridade,
      })
      .from(regrasCategoria)
      .where(eq(regrasCategoria.workspaceId, ws))
    const categorizadas = aplicarRegras(prep.linhas, regras)

    // Uma query para todos os ids (id_externo é único por conta). Passa-se um único parâmetro
    // JSON porque o Drizzle expande arrays JS em lista de parâmetros.
    const existentes = new Set<string>()
    if (categorizadas.length > 0) {
      const ids = JSON.stringify(categorizadas.map((l) => l.idExterno))
      const r = await tx
        .select({ idExterno: lancamentos.idExterno })
        .from(lancamentos)
        .where(
          and(
            eq(lancamentos.workspaceId, ws),
            eq(lancamentos.contaId, contaId),
            sql`${lancamentos.idExterno} in (select jsonb_array_elements_text(${ids}::jsonb))`,
          ),
        )
      for (const x of r) if (x.idExterno) existentes.add(x.idExterno)
    }

    const linhas: LinhaPrevia[] = categorizadas.map((l) => ({ ...l, duplicado: existentes.has(l.idExterno) }))
    return {
      formato: prep.formato,
      linhas,
      erros: prep.erros,
      ...(prep.formato === 'csv' && prep.colunas
        ? {
            colunasCsv: prep.colunas,
            mapeamentoSalvo: mapeamento ?? mapeamentoUtilizavel(conta.mapeamentoCsv, prep.colunas),
          }
        : {}),
    }
  })
}

/** Erros de validação da função SQL (defesa em profundidade) viram erro de domínio. */
function traduzirErroSql(e: unknown): never {
  const c = codigoPg(e)
  if (c === '22023') throw new ErroDominio('importacao.erros.dadosInvalidos')
  if (c === 'P0002') throw new ErroDominio('importacao.erros.importacaoNaoEncontrada')
  throw e
}

export async function confirmarImportacaoDoUsuario(
  userId: string,
  d: ConfirmarInput,
): Promise<ResultadoImportacao> {
  return comUsuario(userId, async (tx) => {
    await buscarConta(tx, d.workspaceId, d.contaId)
    if (d.formato === 'csv' && d.mapeamento) {
      await tx
        .update(contas)
        .set({ mapeamentoCsv: d.mapeamento })
        .where(and(eq(contas.id, d.contaId), eq(contas.workspaceId, d.workspaceId)))
    }
    try {
      const r = await tx.execute(
        sql`select importacao_id, inseridos, ignorados from importar_lancamentos(${d.workspaceId}::uuid, ${d.contaId}::uuid, ${d.arquivo}, ${d.formato}, ${JSON.stringify(d.linhas)}::jsonb)`,
      )
      const linha = r.rows[0] as { importacao_id: string | null; inseridos: number; ignorados: number }
      return {
        importacaoId: linha.importacao_id,
        inseridos: Number(linha.inseridos),
        ignorados: Number(linha.ignorados),
      }
    } catch (e) {
      return traduzirErroSql(e)
    }
  })
}

export async function listarImportacoesDoUsuario(userId: string, ws: string): Promise<ItemHistorico[]> {
  return comUsuario(userId, async (tx) => {
    const r = await tx
      .select({
        id: importacoes.id,
        arquivoNome: importacoes.arquivoNome,
        formato: importacoes.formato,
        qtdLancamentos: importacoes.qtdLancamentos,
        criadoEm: importacoes.criadoEm,
        contaNome: contas.nome,
      })
      .from(importacoes)
      .innerJoin(contas, and(eq(contas.id, importacoes.contaId), eq(contas.workspaceId, importacoes.workspaceId)))
      .where(eq(importacoes.workspaceId, ws))
      .orderBy(desc(importacoes.criadoEm), desc(importacoes.id))
      .limit(50)
    return r.map((i) => ({ ...i, criadoEm: i.criadoEm.toISOString() }))
  })
}

export async function desfazerImportacaoDoUsuario(userId: string, ws: string, importacaoId: string): Promise<void> {
  await comUsuario(userId, async (tx) => {
    const [i] = await tx
      .select({ id: importacoes.id })
      .from(importacoes)
      .where(and(eq(importacoes.id, importacaoId), eq(importacoes.workspaceId, ws)))
    if (!i) throw new ErroDominio('importacao.erros.importacaoNaoEncontrada')
    try {
      await tx.execute(sql`select desfazer_importacao(${importacaoId}::uuid)`)
    } catch (e) {
      traduzirErroSql(e)
    }
  })
}
