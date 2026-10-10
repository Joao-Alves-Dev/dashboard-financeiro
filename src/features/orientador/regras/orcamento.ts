import { formatarBRL } from '@/lib/money'
import type { Alerta, Regra } from '../tipos'
import { pctPiso } from './util'

/**
 * `orcamento-80` (atencao: realizado >= 80% do orçado) e `orcamento-100` (critico: >= 100%). Por categoria
 * dispara só a mais grave: com 100% ou mais NÃO há também o de 80%. Categorias sem orçamento (orçado 0) são
 * ignoradas. Os dois ids existem para que dispensar o aviso de 80% não esconda o de 100% depois.
 */
export const regraOrcamento: Regra = (ctx) => {
  const alertas: Alerta[] = []
  for (const o of ctx.orcamentos) {
    if (o.orcado <= 0) continue
    const pct = pctPiso(o.realizado, o.orcado)
    if (o.realizado >= o.orcado) {
      const excedente = o.realizado - o.orcado
      alertas.push({
        regraId: 'orcamento-100',
        chave: o.categoriaId,
        severidade: 'critico',
        titulo: `Orçamento de ${o.nome} estourou`,
        texto:
          excedente > 0
            ? `${o.nome}: você já gastou ${formatarBRL(o.realizado)} (${pct}%) e o orçamento do mês era ${formatarBRL(o.orcado)}, ${formatarBRL(excedente)} a mais. Evite novos gastos nessa categoria até o fim do mês ou ajuste o orçamento se ele estava irreal.`
            : `${o.nome}: você usou todo o orçamento do mês (${formatarBRL(o.orcado)}). Evite novos gastos nessa categoria até o fim do mês.`,
        dicaId: 'orcamento-realista',
      })
    } else if (o.realizado * 100 >= o.orcado * 80) {
      alertas.push({
        regraId: 'orcamento-80',
        chave: o.categoriaId,
        severidade: 'atencao',
        titulo: `${o.nome} perto do limite do orçamento`,
        texto: `${o.nome}: você já usou ${pct}% do orçamento (${formatarBRL(o.realizado)} de ${formatarBRL(o.orcado)}). Restam ${formatarBRL(o.orcado - o.realizado)} até o fim do mês; vale segurar os gastos dessa categoria.`,
        dicaId: 'orcamento-realista',
      })
    }
  }
  return alertas
}
