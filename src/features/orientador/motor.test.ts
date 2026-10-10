import { describe, expect, it } from 'vitest'
import { avaliar } from './motor'
import { cfg, ctx } from './fabrica-teste'
import { REGRAS_IDS } from './regras'

describe('avaliar', () => {
  // Contexto que dispara regras de quatro severidades distintas.
  const cheio = ctx({
    hoje: '2026-09-15',
    diaDoMes: 15,
    diasNoMes: 30,
    rendaMes: 500_000,
    saidasMes: 400_000, // projeção 800.000 > renda -> critico
    categorias: [{ id: 'c1', nome: 'Alimentação', gastoMes: 110_000, mediaTresMeses: 0 }], // 22% -> atencao
    resultadosTresMeses: [1, 2, 3], // positivo
    // sem metas -> sem-reserva (info)
  })

  it('ordena critico > atencao > info > positivo', () => {
    const r = avaliar(cheio, cfg(), [])
    expect(r.map((a) => a.severidade)).toEqual(['critico', 'atencao', 'info', 'positivo'])
    expect(r.map((a) => a.regraId)).toEqual(['mes-negativo', 'categoria-pct-renda', 'sem-reserva', 'sobra-consistente'])
  })

  it('alerta dispensado com a mesma severidade some', () => {
    const r = avaliar(cheio, cfg(), [{ regraId: 'categoria-pct-renda', chave: 'c1', severidade: 'atencao' }])
    expect(r.map((a) => a.regraId)).not.toContain('categoria-pct-renda')
    expect(r).toHaveLength(3)
  })

  it('dispensado com severidade MAIOR que a atual também some', () => {
    const r = avaliar(cheio, cfg(), [{ regraId: 'categoria-pct-renda', chave: 'c1', severidade: 'critico' }])
    expect(r.map((a) => a.regraId)).not.toContain('categoria-pct-renda')
  })

  it('severidade maior que a dispensada reaparece', () => {
    const r = avaliar(cheio, cfg(), [{ regraId: 'mes-negativo', chave: '', severidade: 'atencao' }])
    expect(r.map((a) => a.regraId)).toContain('mes-negativo')
  })

  it('dispensar uma chave não afeta outra chave da mesma regra', () => {
    const c = ctx({
      rendaMes: 500_000,
      categorias: [
        { id: 'c1', nome: 'A', gastoMes: 110_000, mediaTresMeses: 0 },
        { id: 'c2', nome: 'B', gastoMes: 120_000, mediaTresMeses: 0 },
      ],
      metas: [{ id: 'm', nome: 'Reserva', situacao: 'no_ritmo', necessarioPorMes: 0, sobraMedia: 0 }],
    })
    const r = avaliar(c, cfg(), [{ regraId: 'categoria-pct-renda', chave: 'c1', severidade: 'atencao' }])
    expect(r.map((a) => a.chave)).toEqual(['c2'])
  })

  it('dispensado em OUTRO mês reaparece; do mês corrente some', () => {
    const outroMes = avaliar(cheio, cfg(), [
      { regraId: 'categoria-pct-renda', chave: 'c1', severidade: 'atencao', mes: '2026-08-01' },
    ])
    expect(outroMes.map((a) => a.regraId)).toContain('categoria-pct-renda')
    const mesmoMes = avaliar(cheio, cfg(), [
      { regraId: 'categoria-pct-renda', chave: 'c1', severidade: 'atencao', mes: '2026-09-01' },
    ])
    expect(mesmoMes.map((a) => a.regraId)).not.toContain('categoria-pct-renda')
  })

  it('contexto vazio: só o lembrete de reserva (info)', () => {
    expect(avaliar(ctx(), cfg(), []).map((a) => a.regraId)).toEqual(['sem-reserva'])
  })

  it('todo regraId emitido está em REGRAS_IDS', () => {
    for (const a of avaliar(cheio, cfg(), [])) expect(REGRAS_IDS).toContain(a.regraId)
  })
})
