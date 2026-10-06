import Papa from 'papaparse'
import { parseValorBR } from '@/lib/money'
import { normalizarDataBR } from './datas'
import type { ErroLinha, LinhaImportada, MapeamentoCsv, ResultadoParse } from './tipos'

function semBom(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto
}

/**
 * Escolhe o delimitador pela primeira linha não vazia (cabeçalho): o candidato mais
 * frequente fora de aspas; sem candidato ou empate -> ';' (padrão dos bancos brasileiros).
 * Feito à mão porque a detecção do Papaparse falha quando há linhas em branco.
 */
function detectarDelimitador(texto: string): string {
  const cab = semBom(texto).split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const semAspas = cab.replace(/"[^"]*"/g, '')
  let melhor = ';'
  let max = 0
  for (const d of [';', ',', '\t', '|']) {
    const n = semAspas.split(d).length - 1
    if (n > max) {
      max = n
      melhor = d
    }
  }
  return melhor
}

function ler(texto: string) {
  return Papa.parse<Record<string, string>>(semBom(texto), {
    header: true,
    delimiter: detectarDelimitador(texto),
    skipEmptyLines: false,
    transformHeader: (h) => h.trim(),
  })
}

export function detectarColunasCsv(texto: string): string[] {
  const r = Papa.parse<string[]>(semBom(texto), {
    header: false,
    delimiter: detectarDelimitador(texto),
    preview: 1,
    skipEmptyLines: true,
  })
  const cab = r.data[0]
  return cab ? cab.map((c) => c.trim()) : []
}

export function parseCsv(texto: string, m: MapeamentoCsv): ResultadoParse {
  const r = ler(texto)
  const campos = r.meta.fields ?? []
  for (const col of [m.colData, m.colDescricao, m.colValor]) {
    if (!campos.includes(col)) {
      return { linhas: [], erros: [{ linha: 1, motivo: `coluna não encontrada: ${col}` }] }
    }
  }

  const linhas: LinhaImportada[] = []
  const erros: ErroLinha[] = []

  r.data.forEach((row, i) => {
    // linha 1 = cabeçalho; dados começam na linha 2 (aproximado se houver campos multilinha)
    const linha = i + 2
    const valores = Object.values(row)
    if (valores.every((v) => (v ?? '').trim() === '')) return

    const data = normalizarDataBR(row[m.colData] ?? '')
    if (data === null) {
      erros.push({ linha, motivo: 'data inválida' })
      return
    }
    const valor = parseValorBR(row[m.colValor] ?? '')
    if (valor === null) {
      erros.push({ linha, motivo: 'valor inválido' })
      return
    }
    const descricao = (row[m.colDescricao] ?? '').trim()
    if (descricao === '') {
      erros.push({ linha, motivo: 'descrição vazia' })
      return
    }
    const valorCentavos = m.inverterSinal ? (valor === 0 ? 0 : -valor) : valor
    linhas.push({ linha, data, descricao, valorCentavos })
  })

  return { linhas, erros }
}
