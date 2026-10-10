/**
 * Markdown mínimo dos textos da biblioteca, sem dependência externa. Suporta:
 *  - parágrafos (linhas seguidas viram um parágrafo; linha em branco separa);
 *  - subtítulo: linha começando com `## `;
 *  - lista: linhas começando com `- `;
 *  - exemplo: linhas começando com `> ` (CONVENÇÃO: todo número em reais fica em bloco de exemplo, rotulado como
 *    fictício na tela; ver `biblioteca.test.ts`);
 *  - **negrito** dentro de qualquer um deles.
 * O resultado é uma estrutura de dados; quem exibe cria elementos React com texto comum (nada de HTML cru).
 */
export type Trecho = { texto: string; negrito: boolean }
export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'lista'; itens: Trecho[][] }
  | { tipo: 'exemplo'; linhas: Trecho[][] }

/** `**negrito**` -> trechos. Um `**` sem par fica como texto literal. */
function trechos(linha: string): Trecho[] {
  const partes = linha.split('**')
  // Número par de partes = número ímpar de `**` -> o último não fecha: devolve literal.
  if (partes.length % 2 === 0) return [{ texto: linha, negrito: false }]
  const saida: Trecho[] = []
  partes.forEach((p, i) => {
    if (p !== '') saida.push({ texto: p, negrito: i % 2 === 1 })
  })
  return saida
}

export function textoPuro(ts: Trecho[]): string {
  return ts.map((t) => t.texto).join('')
}

export function renderizarCorpo(corpo: string): Bloco[] {
  const blocos: Bloco[] = []
  let para: string[] = []
  const fecharParagrafo = () => {
    if (para.length > 0) blocos.push({ tipo: 'paragrafo', trechos: trechos(para.join(' ')) })
    para = []
  }

  for (const bruta of corpo.split(/\r?\n/)) {
    const linha = bruta.trim()
    if (linha === '') {
      fecharParagrafo()
    } else if (linha.startsWith('## ')) {
      fecharParagrafo()
      blocos.push({ tipo: 'subtitulo', texto: linha.slice(3).trim() })
    } else if (linha.startsWith('- ')) {
      fecharParagrafo()
      const ultimo = blocos[blocos.length - 1]
      const item = trechos(linha.slice(2).trim())
      if (ultimo?.tipo === 'lista') ultimo.itens.push(item)
      else blocos.push({ tipo: 'lista', itens: [item] })
    } else if (linha.startsWith('> ')) {
      fecharParagrafo()
      const ultimo = blocos[blocos.length - 1]
      const l = trechos(linha.slice(2).trim())
      if (ultimo?.tipo === 'exemplo') ultimo.linhas.push(l)
      else blocos.push({ tipo: 'exemplo', linhas: [l] })
    } else {
      para.push(linha)
    }
  }
  fecharParagrafo()
  return blocos
}
