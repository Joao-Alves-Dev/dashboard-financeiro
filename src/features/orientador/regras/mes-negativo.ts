import { formatarBRL } from '@/lib/money'
import type { Regra } from '../tipos'

/**
 * Antes deste dia do mês a projeção (saídas até hoje / dias decorridos x dias do mês) é ruído: um aluguel pago
 * no dia 1 já "projeta" um mês inteiro de gastos enormes. Decisão do projeto: só avalia a partir do dia 5.
 */
export const DIA_MINIMO_MES_NEGATIVO = 5

/**
 * Projeção de saídas do mês acima da renda do mês. Nunca dispara com renda 0 (se o salário ainda não entrou,
 * o alerta seria falso) nem antes do dia 5. Limitação conhecida: se parte da renda só entra mais tarde no mês,
 * a comparação usa só o que já entrou e pode alertar cedo demais.
 */
export const regraMesNegativo: Regra = (ctx) => {
  if (ctx.rendaMes <= 0 || ctx.diaDoMes < DIA_MINIMO_MES_NEGATIVO || ctx.diaDoMes <= 0) return []
  const projecao = Math.round((ctx.saidasMes * ctx.diasNoMes) / ctx.diaDoMes)
  if (projecao <= ctx.rendaMes) return []
  return [
    {
      regraId: 'mes-negativo',
      chave: '',
      severidade: 'critico',
      titulo: 'O mês está caminhando para fechar no vermelho',
      texto:
        `No ritmo atual de gastos, você deve gastar cerca de ${formatarBRL(projecao)} este mês, mais do que sua renda até agora (${formatarBRL(ctx.rendaMes)}). ` +
        `Olhe as maiores categorias e adie o que não for essencial para fechar o mês no azul.`,
      dicaId: 'cortar-gastos',
    },
  ]
}
