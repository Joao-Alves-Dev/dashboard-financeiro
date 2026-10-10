import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'

/** Metas cuja situação (Task 13, `calcularMeta`) é `atrasada`. `vencida` e `concluida` não entram. */
export const regraMetaAtrasada: Regra = (ctx) =>
  ctx.metas
    .filter((m) => m.situacao === 'atrasada')
    .map((m) => {
      const situacaoSobra =
        m.sobraMedia > 0
          ? `mas sua sobra média dos últimos meses é de ${formatarBRL(m.sobraMedia)}`
          : 'mas, em média, nos últimos meses não sobrou dinheiro'
      return {
        regraId: 'meta-atrasada',
        chave: m.id,
        severidade: 'atencao' as const,
        titulo: `Meta "${m.nome}" fora do ritmo`,
        texto:
          `Para chegar em "${m.nome}" no prazo você precisa guardar ${formatarBRL(m.necessarioPorMes)} por mês, ${situacaoSobra}. ` +
          `Dá para ajustar o prazo, reduzir o valor da meta ou cortar um gasto para liberar a diferença.`,
        dicaId: 'metas-ritmo',
      }
    })
