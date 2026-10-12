/**
 * O primeiro KPI do painel só é um "saldo atual" de verdade se alguma conta informou saldo inicial. Sem nenhum
 * saldo inicial diferente de 0 ele é só a soma dos lançamentos: chamá-lo de saldo enganaria (não é o saldo do
 * banco), então vira "Resultado acumulado". Devolve a chave de `dashboard.kpis` em `messages/pt-BR.json`.
 */
export function chaveRotuloSaldo(contas: { saldoInicialCentavos: number }[]): 'saldoAtual' | 'resultadoAcumulado' {
  return contas.some((c) => c.saldoInicialCentavos !== 0) ? 'saldoAtual' : 'resultadoAcumulado'
}
