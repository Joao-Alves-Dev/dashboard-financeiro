export const ABAS = ['contas', 'categorias', 'regras', 'orientador'] as const
export type Aba = (typeof ABAS)[number]
