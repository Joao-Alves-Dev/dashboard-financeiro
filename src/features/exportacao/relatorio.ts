import { formatarDataBR } from '@/lib/formato'
import { formatarBRL } from '@/lib/money'

export type TipoExportacao = 'saidas' | 'entradas' | 'todas'

export type OpcoesRelatorio = {
  /** Nome que vai no título; vazio = "Todos". */
  favorecido: string
  de: string
  ate: string
  tipo: TipoExportacao
  mostrarTotal: boolean
  anotacoes: 'descricao' | 'branco'
  /** Sem período (voz): ignora `de`/`ate`; o rótulo do período vem da menor e da maior data das linhas. */
  todoPeriodo?: boolean
}

export type Relatorio = {
  titulo: string
  periodo: string
  /** Extremos reais do período, 'YYYY-MM-DD' (ausentes sem linhas em "todo o período"). */
  de?: string
  ate?: string
  linhas: { data: string; anotacao: string; valor: string }[]
  total?: string
}

export type LancamentoExportavel = { data: string; descricao: string; valorCentavos: number }

export const TITULO_PADRAO = 'Transações efetuadas'

/**
 * Monta o conteúdo da lista (puro). Filtra por período (inclusivo) e por tipo, ordena por data
 * crescente (estável: empates mantêm a ordem recebida) e formata. Saídas e entradas saem sem sinal;
 * "todas" mantém o sinal. O total só existe com `mostrarTotal` e soma exatamente o que é exibido.
 */
export function montarRelatorio(lancamentos: LancamentoExportavel[], op: OpcoesRelatorio): Relatorio {
  const nome = op.favorecido.trim().replace(/\s+/g, ' ') || 'Todos'
  const selecionados = lancamentos
    .filter((l) => op.todoPeriodo || (l.data >= op.de && l.data <= op.ate))
    .filter((l) => (op.tipo === 'saidas' ? l.valorCentavos < 0 : op.tipo === 'entradas' ? l.valorCentavos > 0 : true))
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.data < b.l.data ? -1 : a.l.data > b.l.data ? 1 : a.i - b.i))
    .map((x) => x.l)

  const exibido = (l: LancamentoExportavel) => (op.tipo === 'todas' ? l.valorCentavos : Math.abs(l.valorCentavos))

  // Todo o período: o intervalo é o das próprias linhas (já ordenadas por data).
  const de = op.todoPeriodo ? selecionados[0]?.data : op.de
  const ate = op.todoPeriodo ? selecionados[selecionados.length - 1]?.data : op.ate
  const periodo = de !== undefined && ate !== undefined ? `${formatarDataBR(de)} a ${formatarDataBR(ate)}` : 'Todo o período'

  const r: Relatorio = {
    titulo: `${TITULO_PADRAO} | ${nome}`,
    periodo,
    ...(de !== undefined && ate !== undefined ? { de, ate } : {}),
    linhas: selecionados.map((l) => ({
      data: formatarDataBR(l.data),
      anotacao: op.anotacoes === 'branco' ? '' : l.descricao.replace(/\s+/g, ' ').trim(),
      valor: formatarBRL(exibido(l)),
    })),
  }
  if (op.mostrarTotal) r.total = formatarBRL(selecionados.reduce((s, l) => s + exibido(l), 0))
  return r
}
