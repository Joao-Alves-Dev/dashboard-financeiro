import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { comUsuario } from '@/db/com-usuario'
import { categoriaSchema, contaSchema, regraSchema } from '@/features/config/schemas'
import {
  criarCategoriaDoUsuario,
  criarContaDoUsuario,
  criarRegraDoUsuario,
  listarRegrasDoUsuario,
} from '@/features/config/servico'
import { aplicarRegras } from '@/features/importacao/aplicar-regras'
import { lancamentoSchema, type FiltrosLancamentos } from '@/features/lancamentos/schemas'
import { criarLancamentoDoUsuario, listarLancamentosDoUsuario } from '@/features/lancamentos/servico'
import { centavosParaCampo } from '@/lib/formato'
import { interpretarFala } from '@/features/voz/interpretar-fala'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

/**
 * Caminho da voz sem a UI: texto reconhecido -> interpretarFala -> (mesmo mapeamento da ConfirmacaoVoz)
 * -> schema + serviço de criarLancamento -> leitura.
 */
describe('lançamento por voz: interpretarFala -> criarLancamento', () => {
  let ids: string[] = []
  let U: string
  let ws: string
  let conta: string
  let catCombustivel: string
  let catAluguel: string

  async function lancarPorVoz(fala: string, hoje: string) {
    const r = interpretarFala(fala, hoje)
    if (!r.ok) throw new Error(`fala não entendida: ${fala}`)
    const tipo = r.valorCentavos > 0 ? 'entrada' : 'saida'
    const regras = await listarRegrasDoUsuario(U, ws)
    const sugerida = aplicarRegras([{ descricao: r.descricao }], regras)[0].categoriaId
    // Mesma conversão feita pela ConfirmacaoVoz antes de chamar a action criarLancamento.
    const entrada = lancamentoSchema.parse({
      valor: centavosParaCampo(Math.abs(r.valorCentavos)),
      tipo,
      data: r.data,
      descricao: r.descricao,
      contaId: conta,
      categoriaId: sugerida ?? '',
      status: 'efetivado',
      favorecido: r.favorecido ?? '',
    })
    return criarLancamentoDoUsuario(U, ws, entrada)
  }

  const filtros = (o: Partial<FiltrosLancamentos>): FiltrosLancamentos => ({ pagina: 1, ...o })

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(1)
      U = ids[0]
      const r = await comUsuario(U, (tx) => tx.execute(sql`select criar_workspace('Casa voz', 'pessoal') as id`))
      ws = (r.rows[0] as { id: string }).id
      conta = (await criarContaDoUsuario(U, ws, contaSchema.parse({ nome: 'Corrente', tipo: 'corrente', saldoInicial: '' }))).id
      catCombustivel = (await criarCategoriaDoUsuario(U, ws, categoriaSchema.parse({ nome: 'Transporte', natureza: 'despesa' }))).id
      catAluguel = (await criarCategoriaDoUsuario(U, ws, categoriaSchema.parse({ nome: 'Moradia', natureza: 'despesa' }))).id
      await criarRegraDoUsuario(U, ws, regraSchema.parse({ padrao: 'gasolina', categoriaId: catCombustivel, prioridade: '1' }))
      await criarRegraDoUsuario(U, ws, regraSchema.parse({ padrao: 'aluguel', categoriaId: catAluguel, prioridade: '1' }))
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  it('"dia 29 de setembro paguei 100 reais para o senhor Jeová" (hoje 2026-10-08) grava saída, data e favorecido', async () => {
    const l = await lancarPorVoz('dia 29 de setembro paguei 100 reais para o senhor Jeová', '2026-10-08')
    expect(l.valorCentavos).toBe(-10000)
    expect(l.data).toBe('2026-09-29')
    expect(l.descricao).toBe('Para o senhor Jeová')
    expect(l.favorecido).toBe('Jeová')
    expect(l.favorecidoChave).toBe('jeova')
  })

  it('o filtro por favorecido (Task 14b) acha o lançamento por "senhor jeova"', async () => {
    const r = await listarLancamentosDoUsuario(U, ws, filtros({ favorecidoChave: 'senhor jeova' }))
    expect(r.itens.map((i) => i.descricao)).toEqual(['Para o senhor Jeová'])
  })

  it('o reconhecimento em minúsculas também cai na mesma chave e é capitalizado', async () => {
    const l = await lancarPorVoz('200 reais para o senhor jeová', '2026-10-08')
    expect(l.favorecido).toBe('Jeová')
    const r = await listarLancamentosDoUsuario(U, ws, filtros({ favorecidoChave: 'jeova' }))
    expect(r.total).toBe(2)
  })

  it('entrada: "recebi 350 reais do João" grava valor positivo, descrição e favorecido', async () => {
    const l = await lancarPorVoz('recebi 350 reais do João', '2026-10-08')
    expect(l.valorCentavos).toBe(35000)
    expect(l.data).toBe('2026-10-08')
    expect(l.descricao).toBe('Do João')
    expect(l.favorecido).toBe('João')
    expect(l.categoriaId).toBeNull()
  })

  it('o boleto de 5 mil reais grava -500000 com a descrição limpa e sem favorecido', async () => {
    const l = await lancarPorVoz(
      'pagamento do boleto de 5 mil reais referente a financiamento da van Renault',
      '2026-10-08',
    )
    expect(l.valorCentavos).toBe(-500000)
    expect(l.descricao).toBe('Boleto referente a financiamento da van Renault')
    expect(l.favorecido).toBeNull()
    expect(l.favorecidoChave).toBeNull()
  })

  it('categoria sugerida pelas regras do workspace vira a categoria gravada', async () => {
    const a = await lancarPorVoz('ontem paguei 80 reais de gasolina', '2026-10-08')
    expect(a.valorCentavos).toBe(-8000)
    expect(a.data).toBe('2026-10-07')
    expect(a.categoriaId).toBe(catCombustivel)
    const b = await lancarPorVoz('R$ 1.500,50 aluguel', '2026-10-08')
    expect(b.valorCentavos).toBe(-150050)
    expect(b.categoriaId).toBe(catAluguel)
  })

  it('valores com centavos e por extenso chegam exatos ao banco (bigint em centavos)', async () => {
    const a = await lancarPorVoz('200 reais e 50 centavos padaria', '2026-10-08')
    expect(Number(a.valorCentavos)).toBe(-20050)
    const b = await lancarPorVoz('cinco mil e quinhentos de aluguel', '2026-10-08')
    expect(Number(b.valorCentavos)).toBe(-550000)
  })

  it('frase sem valor não gera lançamento', () => {
    expect(interpretarFala('para o senhor Jeová', '2026-10-08')).toEqual({ ok: false, motivo: 'sem_valor' })
  })
})
