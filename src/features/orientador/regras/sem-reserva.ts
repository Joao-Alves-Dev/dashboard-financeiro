import type { Regra } from '../tipos'

/**
 * Nenhuma meta (concluída ou não) cujo nome contenha "reserva", sem diferenciar maiúsculas de minúsculas e
 * em qualquer posição do nome. É um lembrete (info), não uma falha.
 */
export const regraSemReserva: Regra = (ctx) => {
  if (ctx.metas.some((m) => m.nome.toLowerCase().includes('reserva'))) return []
  return [
    {
      regraId: 'sem-reserva',
      chave: '',
      severidade: 'info',
      titulo: 'Você ainda não tem uma reserva de emergência',
      texto:
        'Não encontramos uma meta de reserva. Uma reserva ajuda a atravessar imprevistos sem recorrer ao cartão ou a empréstimos. ' +
        'Crie na tela Metas uma meta com "Reserva" no nome para acompanhar o quanto já guardou.',
      dicaId: 'reserva-emergencia',
    },
  ]
}
