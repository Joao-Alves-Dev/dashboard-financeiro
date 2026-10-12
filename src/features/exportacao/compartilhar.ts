export type ResultadoCompartilhar = 'compartilhado' | 'baixado' | 'cancelado'

/** "Jerônimo Silva" → "jeronimo-silva"; vazio → "todos". Só letras minúsculas sem acento, números e hífen. */
export function slugArquivo(nome: string): string {
  const s = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'todos'
}

/** `transacoes-jeronimo-2026-03-12-a-2026-03-26.png`; com várias partes: `...-parte-2-de-3.png`. */
export function nomeArquivoExportacao(
  nome: string,
  de: string,
  ate: string,
  extensao: 'png' | 'pdf',
  parte?: { numero: number; total: number },
): string {
  const sufixo = parte && parte.total > 1 ? `-parte-${parte.numero}-de-${parte.total}` : ''
  return `transacoes-${slugArquivo(nome)}-${de}-a-${ate}${sufixo}.${extensao}`
}

function baixar(arquivos: File[]): void {
  arquivos.forEach((arquivo, i) => {
    // Vários downloads seguidos: um pequeno intervalo evita que o navegador bloqueie os seguintes.
    setTimeout(() => {
      const url = URL.createObjectURL(arquivo)
      const a = document.createElement('a')
      a.href = url
      a.download = arquivo.name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    }, i * 250)
  })
}

/**
 * Compartilha os arquivos pelo menu do sistema (Web Share com arquivos: no celular, abre o WhatsApp
 * entre as opções). Sem suporte, ou se o compartilhamento falhar por outro motivo que não o
 * cancelamento, baixa os arquivos. Cancelar o menu NÃO é erro.
 */
export async function compartilharOuBaixar(arquivos: File[], titulo: string): Promise<ResultadoCompartilhar> {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    let pode = false
    try {
      pode = nav.canShare({ files: arquivos })
    } catch {
      pode = false
    }
    if (pode) {
      try {
        await nav.share({ files: arquivos, title: titulo })
        return 'compartilhado'
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelado'
        // Outro erro (ex.: sem permissão): cai no download.
      }
    }
  }
  baixar(arquivos)
  return 'baixado'
}

export { baixar as baixarArquivos }
