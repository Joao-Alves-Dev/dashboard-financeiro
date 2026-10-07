/** '2026-03-15' -> '15/03/2026' por string (sem Date/fuso). Entrada fora do padrão volta inalterada. */
export function formatarDataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Centavos -> texto editável pt-BR sem símbolo nem milhar ('1234,56'); sinal preservado. */
export function centavosParaCampo(centavos: number): string {
  const abs = Math.abs(centavos)
  const inteiro = Math.floor(abs / 100)
  const dec = String(abs % 100).padStart(2, '0')
  return `${centavos < 0 ? '-' : ''}${inteiro},${dec}`
}

/**
 * Data de hoje no fuso local do navegador, como 'YYYY-MM-DD' (só para pré-preencher formulários;
 * a data do lançamento em si nunca passa por Date/fuso).
 */
export function hojeLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
