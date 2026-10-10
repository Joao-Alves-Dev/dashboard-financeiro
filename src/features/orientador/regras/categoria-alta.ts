import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'
import { pctAcima } from './util'

/**
 * Categoria com gasto do mês acima da média dos 3 meses anteriores x (1 + altaPct/100). A média considera
 * os meses sem gasto como 0; sem histórico (média 0) a regra não dispara. Comparação exata em inteiros:
 * gasto * 100 > média * (100 + altaPct).
 */
export const regraCategoriaAlta: Regra = (ctx, cfg) =>
  ctx.categorias
    .filter((c) => c.mediaTresMeses > 0 && c.gastoMes * 100 > c.mediaTresMeses * (100 + cfg.altaPct))
    .map((c) => {
      const pct = pctAcima(((c.gastoMes - c.mediaTresMeses) * 100) / c.mediaTresMeses, cfg.altaPct)
      return {
        regraId: 'categoria-alta',
        chave: c.id,
        severidade: 'atencao' as const,
        titulo: `${c.nome} acima do seu normal`,
        texto:
          `${c.nome} já está ${pct}% acima da sua média dos últimos 3 meses (${formatarBRL(c.gastoMes)} este mês, contra ${formatarBRL(c.mediaTresMeses)} em média). ` +
          `Vale conferir o que mudou: foi um gasto pontual ou um hábito novo?`,
        dicaId: 'revisar-habitos',
      }
    })
