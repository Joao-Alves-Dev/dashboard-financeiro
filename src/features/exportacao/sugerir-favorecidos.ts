import { normalizarFavorecido } from '@/features/favorecido/normalizar'

type Candidato = { chave: string; nome: string }

/** Distância de edição (Levenshtein) entre duas strings curtas. */
function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const atual = [i]
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    anterior = atual
  }
  return anterior[b.length]
}

/** Distância máxima aceita: 1 para palavras curtas (até 7 letras), 2 acima disso. */
const tolerancia = (tamanho: number) => (tamanho <= 7 ? 1 : 2)

/**
 * Nomes já usados que se parecem com o que foi pedido. Compara a chave normalizada (sem acento nem
 * tratamento): igualdade, depois nome que contém a busca (ou vice-versa), depois distância de edição
 * pequena sobre a chave inteira ou sobre cada palavra. Em empate, vale a ordem de `existentes`.
 */
export function sugerirFavorecidos(busca: string, existentes: Candidato[], limite = 3): Candidato[] {
  const chave = normalizarFavorecido(busca)
  if (chave === '' || limite <= 0) return []

  const pontuados: { c: Candidato; nota: number; i: number }[] = []
  existentes.forEach((c, i) => {
    let nota: number | null = null
    if (c.chave === chave) nota = 0
    else if (chave.length >= 3 && (c.chave.includes(chave) || (c.chave.length >= 3 && chave.includes(c.chave)))) nota = 1
    else {
      let melhor = distancia(chave, c.chave)
      if (melhor > tolerancia(Math.max(chave.length, c.chave.length))) {
        melhor = Infinity
        const palavrasBusca = chave.split(' ')
        for (const pc of c.chave.split(' ')) {
          for (const pb of palavrasBusca) {
            if (pb.length >= 3 && pc.length >= 3) {
              const d = distancia(pb, pc)
              if (d <= tolerancia(Math.max(pb.length, pc.length))) melhor = Math.min(melhor, d)
            }
          }
        }
        if (melhor !== Infinity) nota = 1 + melhor
      } else nota = 1 + melhor
    }
    if (nota !== null) pontuados.push({ c, nota, i })
  })
  return pontuados
    .sort((a, b) => a.nota - b.nota || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.c)
}
