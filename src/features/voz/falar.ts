/** Fala o texto em pt-BR com a voz do navegador. Não falha (nem avisa) se não houver `speechSynthesis`. */
export function falar(texto: string): void {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(texto)
    u.lang = 'pt-BR'
    u.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    // A confirmação falada é um reforço: a visual sempre aparece.
  }
}

export function calarFala(): void {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // ignora
  }
}
