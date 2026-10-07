/** Classe de cor por sinal do valor (entrada verde, saída vermelha, zero neutro). */
export function classeValor(centavos: number): string {
  if (centavos > 0) return 'text-green-700 dark:text-green-400'
  if (centavos < 0) return 'text-red-700 dark:text-red-400'
  return 'text-muted-foreground'
}
