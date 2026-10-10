import { describe, expect, it } from 'vitest'
import { cfg, ctx } from '../fabrica-teste'
import { regraSemReserva } from './sem-reserva'

const meta = (nome: string) => ({ id: 'm', nome, situacao: 'no_ritmo' as const, necessarioPorMes: 0, sobraMedia: 0 })

describe('sem-reserva', () => {
  it('nenhuma meta -> info', () => {
    const r = regraSemReserva(ctx(), cfg())
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ regraId: 'sem-reserva', chave: '', severidade: 'info', dicaId: 'reserva-emergencia' })
  })

  it('metas sem "reserva" no nome -> info', () => {
    expect(regraSemReserva(ctx({ metas: [meta('Viagem'), meta('Carro')] }), cfg())).toHaveLength(1)
  })

  it('meta "Reserva de emergência" -> []', () => {
    expect(regraSemReserva(ctx({ metas: [meta('Reserva de emergência')] }), cfg())).toEqual([])
  })

  it('"RESERVA" e "reserva" em qualquer lugar do nome também casam', () => {
    expect(regraSemReserva(ctx({ metas: [meta('RESERVA')] }), cfg())).toEqual([])
    expect(regraSemReserva(ctx({ metas: [meta('Minha reserva do ano')] }), cfg())).toEqual([])
    expect(regraSemReserva(ctx({ metas: [meta('Pré-reservas')] }), cfg())).toEqual([])
  })

  it('meta concluída de reserva também conta', () => {
    expect(regraSemReserva(ctx({ metas: [{ ...meta('Reserva'), situacao: 'concluida' }] }), cfg())).toEqual([])
  })
})
