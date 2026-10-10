import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'
import { pctAcima } from './util'

/**
 * Categoria que consome mais que `cfg.limiteCategoriaPct` % da renda do mês (comparação exata, em inteiros:
 * gasto * 100 > limite * renda). Sem renda no mês a regra não dispara (percentual sem sentido).
 */
export const regraCategoriaPctRenda: Regra = (ctx, cfg) => {
  if (ctx.rendaMes <= 0) return []
  return ctx.categorias
    .filter((c) => c.gastoMes * 100 > cfg.limiteCategoriaPct * ctx.rendaMes)
    .map((c) => {
      const pct = pctAcima((c.gastoMes * 100) / ctx.rendaMes, cfg.limiteCategoriaPct)
      return {
        regraId: 'categoria-pct-renda',
        chave: c.id,
        severidade: 'atencao' as const,
        titulo: `${c.nome} pesa na sua renda`,
        texto:
          `${c.nome} consumiu ${pct}% da sua renda este mês (${formatarBRL(c.gastoMes)}). ` +
          `Seu limite configurado é ${cfg.limiteCategoriaPct}%. ` +
          `Veja se dá para reduzir algum gasto dessa categoria nas próximas semanas.`,
        dicaId: 'orcamento-50-30-20',
      }
    })
}
