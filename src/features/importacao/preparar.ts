import { ErroDominio } from '@/lib/erro-dominio'
import { decodificarArquivo } from './decodificar'
import { atribuirIdsExternos } from './id-externo'
import { parseCsv, detectarColunasCsv } from './parse-csv'
import { parseOfx } from './parse-ofx'
import { MAX_LINHAS, detectarFormato, type Formato } from './schemas'
import type { ErroLinha, LinhaImportada, MapeamentoCsv } from './tipos'

export type LinhaComId = LinhaImportada & { idExterno: string }

export type Preparado =
  | { tipo: 'precisa_mapeamento'; formato: 'csv'; colunas: string[] }
  | { tipo: 'ok'; formato: Formato; linhas: LinhaComId[]; erros: ErroLinha[]; colunas?: string[] }

const DESCRICAO_MAX = 200

/**
 * Bytes -> linhas prontas (ids externos atribuídos), sem banco. Lança ErroDominio para arquivo
 * vazio, `.ofx` sem conteúdo OFX, coluna inexistente, sem transações ou acima do limite.
 * Valor zero vira erro de linha (o parser o aceita; o banco recusa).
 */
export function prepararArquivo(
  bytes: Uint8Array,
  extensao: Formato,
  mapeamento: MapeamentoCsv | null,
): Preparado {
  const texto = decodificarArquivo(bytes)
  if (texto.trim() === '') throw new ErroDominio('importacao.erros.arquivoVazio')

  const formato = detectarFormato(extensao, texto)
  if (formato === null) throw new ErroDominio('importacao.erros.naoOfx')

  let bruto: { linhas: LinhaImportada[]; erros: ErroLinha[] }
  let colunas: string[] | undefined
  if (formato === 'ofx') {
    bruto = parseOfx(texto)
  } else {
    colunas = detectarColunasCsv(texto)
    if (colunas.length === 0) throw new ErroDominio('importacao.erros.arquivoVazio')
    if (mapeamento === null) return { tipo: 'precisa_mapeamento', formato: 'csv', colunas }
    for (const col of [mapeamento.colData, mapeamento.colDescricao, mapeamento.colValor]) {
      if (!colunas.includes(col)) throw new ErroDominio('importacao.erros.colunaInexistente', { coluna: col })
    }
    bruto = parseCsv(texto, mapeamento)
  }

  if (bruto.linhas.length === 0 && bruto.erros.length === 0) {
    throw new ErroDominio('importacao.erros.semTransacoes')
  }

  const erros = [...bruto.erros]
  const validas: LinhaImportada[] = []
  for (const l of bruto.linhas) {
    if (l.valorCentavos === 0) erros.push({ linha: l.linha, motivo: 'valor zero' })
    else validas.push(l)
  }
  erros.sort((a, b) => a.linha - b.linha)

  if (validas.length > MAX_LINHAS) {
    throw new ErroDominio('importacao.erros.muitasLinhas', { max: MAX_LINHAS })
  }

  // ids calculados sobre a descrição completa; só depois ela é limitada ao tamanho do banco/schema
  const linhas = atribuirIdsExternos(validas).map((l) => ({
    ...l,
    descricao: l.descricao.slice(0, DESCRICAO_MAX).trim(),
  }))
  return { tipo: 'ok', formato, linhas, erros, colunas }
}
