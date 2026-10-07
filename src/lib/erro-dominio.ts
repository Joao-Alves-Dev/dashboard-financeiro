/** Erro esperado de regra de negócio; `chave` é uma chave de `messages/pt-BR.json`. */
export class ErroDominio extends Error {
  constructor(
    readonly chave: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(chave)
    this.name = 'ErroDominio'
  }
}

/** SQLSTATE do erro do Postgres (o Drizzle embrulha o erro original em `cause`). */
export function codigoPg(e: unknown): string | undefined {
  const x = e as { code?: unknown; cause?: { code?: unknown } } | null
  const c = x?.cause?.code ?? x?.code
  return typeof c === 'string' ? c : undefined
}
