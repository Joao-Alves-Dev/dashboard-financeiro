import { normalizarFavorecido } from '@/features/favorecido/normalizar'

export type FavorecidoConhecido = { chave: string; nome: string }

export type OpcoesInterpretacao = { favorecidosConhecidos?: FavorecidoConhecido[] }

const CONECTORES = new Set([
  'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'com', 'por', 'pra', 'para', 'pro', 'pelo', 'pela',
  'ao', 'sobre', 'ref', 'referente',
])

/**
 * Reconhece, entre os favorecidos já cadastrados, o nome que a fala quis dizer. A extração do nome
 * (`lerNome`) pega até 4 palavras, então "para o senhor jerônimo de viagem" vira "Jerônimo de Viagem".
 *
 * Regras: compara por chave (`normalizarFavorecido`), palavra a palavra; vence o conhecido de MAIOR
 * número de palavras que seja prefixo do candidato. Se ele é o candidato inteiro, devolve o conhecido.
 * Se sobram palavras e a primeira sobra é conector (de, da, em, para, referente...), trunca no
 * conhecido (o resto continua na descrição, que não muda). Se a primeira sobra NÃO é conector
 * ("Jerônimo Silva" com "Jerônimo" conhecido), é outra pessoa de nome mais longo: mantém o candidato.
 * O favorecido devolvido usa a grafia `nome` do conhecido. Sem conhecidos, devolve o candidato.
 */
export function resolverFavorecidoConhecido(candidato: string, conhecidos: FavorecidoConhecido[]): string {
  if (conhecidos.length === 0) return candidato
  const palavras = normalizarFavorecido(candidato).split(' ').filter(Boolean)
  if (palavras.length === 0) return candidato

  let melhor: FavorecidoConhecido | null = null
  let melhorN = 0
  for (const c of conhecidos) {
    const kw = c.chave.split(' ').filter(Boolean)
    if (kw.length === 0 || kw.length > palavras.length || kw.length <= melhorN) continue
    if (kw.every((w, i) => w === palavras[i])) {
      melhor = c
      melhorN = kw.length
    }
  }
  if (!melhor) return candidato
  if (melhorN === palavras.length) return melhor.nome
  return CONECTORES.has(palavras[melhorN]) ? melhor.nome : candidato
}
