import { DICAS } from './conteudo'
import { TEMAS, type Dica, type Tema } from './tipos'

export { TEMAS }
export type { Dica, Tema }

/** Aviso fixo, exibido em toda dica. */
export const AVISO_EDUCATIVO = 'Conteúdo educativo; não é recomendação de investimento.'

/** Rótulo dos blocos de exemplo (linhas "> " do corpo): os números nunca são reais nem metas. */
export const ROTULO_EXEMPLO = 'Exemplo com números fictícios'

/**
 * Os textos são módulos TypeScript (e não arquivos .md lidos em runtime) porque na Vercel o bundle serverless
 * não rastreia de forma confiável arquivos lidos por `fs`: módulos entram no bundle por import estático.
 */
export function carregarBiblioteca(): Dica[] {
  return DICAS
}

export const IDS_DICAS: readonly string[] = DICAS.map((d) => d.id)

export function obterDica(id: string): Dica | undefined {
  return DICAS.find((d) => d.id === id)
}
