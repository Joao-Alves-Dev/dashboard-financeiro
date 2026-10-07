export const ABAS = ['contas', 'categorias', 'regras'] as const
export type Aba = (typeof ABAS)[number]
