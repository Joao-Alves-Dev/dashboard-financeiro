/**
 * O driver WebSocket do Neon pode entregar uma conexão que o servidor (PgBouncer ou suspensão
 * do compute) já derrubou; o primeiro comando nela falha com "Connection terminated unexpectedly".
 * Repetir é seguro quando a falha acontece ANTES de qualquer trabalho do chamador, porque nada
 * foi executado. Depois que o trabalho começou, não repetimos: um commit cuja confirmação se
 * perdeu duplicaria gravações.
 */

const PADRAO_ERRO_CONEXAO =
  /connection terminated|connection closed|connection ended|econnreset|socket hang up|websocket/i

/** Procura o padrão na mensagem do erro e na cadeia de `cause` (o Drizzle embrulha o erro do driver). */
export function ehErroDeConexao(erro: unknown): boolean {
  const visitados = new Set<unknown>()
  let atual: unknown = erro
  while (atual && typeof atual === 'object' && !visitados.has(atual)) {
    visitados.add(atual)
    const { message, cause } = atual as { message?: unknown; cause?: unknown }
    if (typeof message === 'string' && PADRAO_ERRO_CONEXAO.test(message)) return true
    atual = cause
  }
  return false
}

/**
 * Executa `executar`, que deve chamar `sinalizarInicio()` assim que o trabalho do chamador
 * começar. Repete (até `tentativas` no total) apenas se o erro for de conexão e o trabalho
 * ainda não tiver começado.
 */
export async function comRetryAntesDeIniciar<T>(
  executar: (sinalizarInicio: () => void) => Promise<T>,
  tentativas = 2,
): Promise<T> {
  for (let i = 1; ; i++) {
    let iniciou = false
    try {
      return await executar(() => {
        iniciou = true
      })
    } catch (erro) {
      if (iniciou || i >= tentativas || !ehErroDeConexao(erro)) throw erro
    }
  }
}
