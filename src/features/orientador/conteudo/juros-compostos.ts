import type { Dica } from '../tipos'

export const dica: Dica = {
  id: 'juros-compostos',
  titulo: 'Juros compostos: o efeito bola de neve',
  tema: 'investir',
  resumo: 'Juros sobre juros: por que o tempo importa tanto, tanto para quem guarda quanto para quem deve.',
  corpo: `Juros compostos são juros sobre juros. A cada período, o rendimento (ou a cobrança) é calculado sobre o valor já acrescido dos juros anteriores. Por isso o crescimento acelera com o tempo.

## Um exemplo ilustrativo

> Você aplica R$ 1.000,00 e o valor cresce 10% por período.
> Após o 1.º período: R$ 1.100,00.
> Após o 2.º período: R$ 1.210,00, porque os juros do 2.º período foram calculados sobre R$ 1.100,00 e não sobre R$ 1.000,00.
> Após o 3.º período: R$ 1.331,00.
> Com juros simples, o ganho seria sempre de R$ 100,00 por período, e o total chegaria a R$ 1.300,00.

A diferença parece pequena no começo e cresce com o tempo. A taxa do exemplo é inventada para facilitar a conta; não é uma expectativa de rendimento real.

## Os três ingredientes

- **Tempo:** quanto mais cedo você começa, mais períodos de efeito acumulado.
- **Constância:** aportes regulares criam novas bases para o cálculo.
- **Taxa:** pequenas diferenças de taxa viram grandes diferenças depois de muitos anos. As taxas reais mudam; consulte o Banco Central e o Tesouro Direto.

## O outro lado

Os juros compostos também funcionam contra você: dívida de cartão ou de cheque especial cresce do mesmo jeito. Por isso, dívida cara é prioridade.

## Cuidados

Rendimento passado não garante rendimento futuro. O ganho real pode ser menor do que o mostrado em simuladores, por causa de impostos, taxas e inflação. E aplicações de risco podem perder valor em vez de crescer.`,
}
