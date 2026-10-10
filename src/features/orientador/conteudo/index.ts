import type { Dica } from '../tipos'
import { dica as dOrcamento503020 } from './orcamento-50-30-20'
import { dica as dOrcamentoRealista } from './orcamento-realista'
import { dica as dCortarGastos } from './cortar-gastos'
import { dica as dRevisarHabitos } from './revisar-habitos'
import { dica as dReservaEmergencia } from './reserva-emergencia'
import { dica as dOndeGuardar } from './onde-guardar'
import { dica as dMetasRitmo } from './metas-ritmo'
import { dica as dJurosCartao } from './juros-cartao'
import { dica as dQuitarDividas } from './quitar-dividas'
import { dica as dJurosCompostos } from './juros-compostos'
import { dica as dRendaFixaBasico } from './renda-fixa-basico'
import { dica as dFgc } from './fgc'
import { dica as dRendaVariavelRisco } from './renda-variavel-risco'

/** Ordem de exibição dentro de cada tema. */
export const DICAS: Dica[] = [
  dOrcamento503020,
  dOrcamentoRealista,
  dCortarGastos,
  dRevisarHabitos,
  dReservaEmergencia,
  dOndeGuardar,
  dMetasRitmo,
  dJurosCartao,
  dQuitarDividas,
  dJurosCompostos,
  dRendaFixaBasico,
  dFgc,
  dRendaVariavelRisco,
]
