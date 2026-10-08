export type Edicao = 'pessoal' | 'portfolio'

/**
 * Edição da instalação. Sem argumento lê NEXT_PUBLIC_EDICAO, que o Next substitui
 * pelo valor literal no build (a referência `process.env.NEXT_PUBLIC_EDICAO` precisa
 * ficar direta, sem lookup dinâmico). Ausente ou inválido => 'pessoal' (o mais restritivo).
 */
export function obterEdicao(valor: string | undefined = process.env.NEXT_PUBLIC_EDICAO): Edicao {
  return valor?.trim().toLowerCase() === 'portfolio' ? 'portfolio' : 'pessoal'
}

export function recursos(e: Edicao): { demo: boolean; cadastroAberto: boolean } {
  return e === 'portfolio'
    ? { demo: true, cadastroAberto: true }
    : { demo: false, cadastroAberto: false }
}
