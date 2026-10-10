/** Tratamentos removidos quando aparecem como primeiros tokens do nome (comparados já normalizados). */
const TRATAMENTOS = new Set(['senhor', 'senhora', 'sr', 'sra', 'seu', 'dona', 'dr', 'dra', 'doutor', 'doutora'])

/** Tamanho máximo do nome do favorecido (igual ao check do banco). */
export const FAVORECIDO_MAX = 80

/**
 * Chave de busca/agrupamento: sem acentos, minúsculas, sem `.` e `,`, espaços colapsados e sem
 * tratamentos nos primeiros tokens ("Senhor Jeová", "Sr. Jeová" e "jeova" → "jeova").
 * Tratamentos no meio/fim do nome são preservados ("Zé do Sr. Silva").
 */
export function normalizarFavorecido(nome: string): string {
  const tokens = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[.,]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  let i = 0
  while (i < tokens.length && TRATAMENTOS.has(tokens[i])) i++
  return tokens.slice(i).join(' ')
}

/**
 * Nome exibido (aparado, espaços colapsados, grafia como digitada, tratamento incluído) e chave.
 * `null` se a chave ficar vazia (nada, ou só tratamento).
 */
export function limparFavorecido(nome: string): { favorecido: string; chave: string } | null {
  const favorecido = nome.trim().replace(/\s+/g, ' ')
  const chave = normalizarFavorecido(favorecido)
  return chave ? { favorecido, chave } : null
}
