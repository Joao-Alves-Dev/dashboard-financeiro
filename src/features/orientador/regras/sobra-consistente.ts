import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'

/** Os 3 últimos meses fechados com resultado estritamente positivo (zero não é sobra). Exige os 3 meses. */
export const regraSobraConsistente: Regra = (ctx) => {
  const r = ctx.resultadosTresMeses
  if (r.length < 3 || !r.every((v) => v > 0)) return []
  const media = Math.round(r.reduce((a, b) => a + b, 0) / r.length)
  return [
    {
      regraId: 'sobra-consistente',
      chave: '',
      severidade: 'positivo',
      titulo: 'Três meses seguidos fechando no azul',
      texto:
        `Nos últimos 3 meses sobrou dinheiro todos os meses (média de ${formatarBRL(media)} por mês). ` +
        `Vale decidir para onde ele vai: veja "Onde deixar o dinheiro guardado".`,
      dicaId: 'onde-guardar',
    },
  ]
}
