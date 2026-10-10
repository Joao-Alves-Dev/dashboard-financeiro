import { inicioDoMes } from '@/features/dashboard/periodo'
import { REGRAS } from './regras'
import { ORDEM_SEVERIDADE, type Alerta, type ConfigOrientador, type ContextoFinanceiro, type Dispensado } from './tipos'

/**
 * Avalia todas as regras e devolve os alertas ativos, do mais grave ao menos grave (critico > atencao > info >
 * positivo; dentro da mesma severidade vale a ordem de `REGRAS`).
 *
 * Dispensar: um alerta é escondido se existe dispensa para (regraId, chave) com severidade >= à atual. Se a
 * severidade atual é MAIOR que a dispensada, o alerta reaparece. Dispensas com `mes` só valem no mês de
 * `ctx.hoje` (no mês seguinte tudo volta); sem `mes`, o chamador já filtrou o mês.
 */
export function avaliar(ctx: ContextoFinanceiro, cfg: ConfigOrientador, dispensados: Dispensado[]): Alerta[] {
  const mesAtual = inicioDoMes(ctx.hoje)
  const vigentes = dispensados.filter((d) => d.mes === undefined || d.mes === mesAtual)
  const ativos = REGRAS.flatMap((regra) => regra(ctx, cfg)).filter(
    (a) =>
      !vigentes.some(
        (d) => d.regraId === a.regraId && d.chave === a.chave && ORDEM_SEVERIDADE[d.severidade] >= ORDEM_SEVERIDADE[a.severidade],
      ),
  )
  // Array.prototype.sort é estável (ES2019): preserva a ordem das regras dentro da severidade.
  return ativos.sort((a, b) => ORDEM_SEVERIDADE[b.severidade] - ORDEM_SEVERIDADE[a.severidade])
}
