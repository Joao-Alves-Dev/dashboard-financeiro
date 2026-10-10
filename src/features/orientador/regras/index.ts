import type { Regra } from '../tipos'
import { regraCartaoAlto } from './cartao-alto'
import { regraCategoriaAlta } from './categoria-alta'
import { regraCategoriaPctRenda } from './categoria-pct-renda'
import { regraMesNegativo } from './mes-negativo'
import { regraMetaAtrasada } from './meta-atrasada'
import { regraOrcamento } from './orcamento'
import { regraSemReserva } from './sem-reserva'
import { regraSobraConsistente } from './sobra-consistente'

/** Ordem de avaliação (desempata a ordenação por severidade, que é estável). */
export const REGRAS: Regra[] = [
  regraMesNegativo,
  regraOrcamento,
  regraCategoriaPctRenda,
  regraCategoriaAlta,
  regraCartaoAlto,
  regraMetaAtrasada,
  regraSemReserva,
  regraSobraConsistente,
]

/** Ids que as regras podem emitir (validação de "dispensar" e testes). */
export const REGRAS_IDS = [
  'categoria-pct-renda',
  'orcamento-80',
  'orcamento-100',
  'mes-negativo',
  'categoria-alta',
  'meta-atrasada',
  'sem-reserva',
  'sobra-consistente',
  'cartao-alto',
] as const
