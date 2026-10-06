import { createHash } from 'node:crypto'
import type { LinhaImportada } from './tipos'

function normalizarDescricao(s: string): string {
  return s.normalize('NFC').trim().toUpperCase().replace(/\s+/g, ' ')
}

/**
 * Garante um idExterno em toda linha. Linhas que já têm (FITID do OFX) o mantêm.
 * As demais recebem `csv:` + SHA-256 de `data|valor|descricaoNormalizada|indiceOcorrencia`,
 * onde o índice (0-based) separa transações idênticas do mesmo arquivo — dois cafés iguais
 * no mesmo dia geram ids distintos, e reprocessar o mesmo arquivo gera os mesmos ids.
 */
export function atribuirIdsExternos(
  linhas: LinhaImportada[],
): (LinhaImportada & { idExterno: string })[] {
  const ocorrencias = new Map<string, number>()
  return linhas.map((l) => {
    if (l.idExterno) return { ...l, idExterno: l.idExterno }
    const base = `${l.data}|${l.valorCentavos}|${normalizarDescricao(l.descricao)}`
    const indice = ocorrencias.get(base) ?? 0
    ocorrencias.set(base, indice + 1)
    const hash = createHash('sha256').update(`${base}|${indice}`).digest('hex')
    return { ...l, idExterno: `csv:${hash}` }
  })
}
