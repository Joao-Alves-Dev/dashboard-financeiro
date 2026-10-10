import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'
import { pctAcima } from './util'

/** Saídas efetivadas em contas tipo cartão acima de `cfg.cartaoPct` % da renda do mês. Sem renda não dispara. */
export const regraCartaoAlto: Regra = (ctx, cfg) => {
  if (ctx.rendaMes <= 0 || ctx.gastoCartaoMes * 100 <= cfg.cartaoPct * ctx.rendaMes) return []
  const pct = pctAcima((ctx.gastoCartaoMes * 100) / ctx.rendaMes, cfg.cartaoPct)
  return [
    {
      regraId: 'cartao-alto',
      chave: '',
      severidade: 'atencao',
      titulo: 'O cartão está pesando no mês',
      texto:
        `Os gastos no cartão somam ${formatarBRL(ctx.gastoCartaoMes)} este mês, ${pct}% da sua renda (seu limite configurado é ${cfg.cartaoPct}%). ` +
        `Garanta o dinheiro para pagar a fatura inteira no vencimento: os juros do rotativo e do atraso da fatura estão entre os mais altos do crédito no país.`,
      dicaId: 'juros-cartao',
    },
  ]
}
