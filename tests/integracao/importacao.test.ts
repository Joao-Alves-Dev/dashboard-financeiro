import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { comUsuario } from '@/db/com-usuario'
import { contas, importacoes, lancamentos } from '@/db/schema'
import { criarContaDoUsuario, criarRegraDoUsuario, listarCategoriasDoUsuario } from '@/features/config/servico'
import { contaSchema, regraSchema } from '@/features/config/schemas'
import { confirmarSchema } from '@/features/importacao/schemas'
import {
  confirmarImportacaoDoUsuario,
  desfazerImportacaoDoUsuario,
  listarImportacoesDoUsuario,
  previaImportacaoDoUsuario,
  type Previa,
} from '@/features/importacao/servico'
import type { MapeamentoCsv } from '@/features/importacao/tipos'
import { codigoPg, ErroDominio } from '@/lib/erro-dominio'
import { apagarUsuariosTeste, criarUsuariosTeste } from './usuarios'

type LinhaSql = {
  data: string
  descricao: string
  valorCentavos: number
  idExterno: string
  categoriaId?: string | null
}
type Res = { importacao_id: string | null; inseridos: number; ignorados: number }

const fixture = (n: string) => new Uint8Array(readFileSync(join(process.cwd(), 'src/features/importacao/__fixtures__', n)))
const enc = (s: string) => new TextEncoder().encode(s)
const MAP: MapeamentoCsv = { colData: 'Data', colDescricao: 'Descrição', colValor: 'Valor', inverterSinal: false }

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (e) {
    return codigoPg(e) ?? `outro:${(e as Error).message}`
  }
  return undefined
}

describe('importação (funções SQL e fluxo)', () => {
  let ids: string[] = []
  let A: string
  let B: string
  let wsA: string
  let wsB: string
  let contaA: string
  let contaA2: string
  let contaB: string
  let catA: string
  let catB: string

  const linhas = (n = 3, prefixo = 'x'): LinhaSql[] =>
    Array.from({ length: n }, (_, i) => ({
      data: '2026-03-15',
      descricao: `Item ${i + 1}`,
      valorCentavos: -(i + 1) * 100,
      idExterno: `${prefixo}-${i + 1}`,
    }))

  async function importar(u: string, ws: string, conta: string, ls: unknown, formato = 'csv', arquivo = 'a.csv') {
    const r = await comUsuario(u, (tx) =>
      tx.execute(
        sql`select * from importar_lancamentos(${ws}::uuid, ${conta}::uuid, ${arquivo}, ${formato}, ${JSON.stringify(ls)}::jsonb)`,
      ),
    )
    return r.rows[0] as Res
  }

  const contagemLanc = (conta: string) =>
    comUsuario(A, async (tx) => (await tx.select().from(lancamentos).where(eq(lancamentos.contaId, conta))).length)
  const contagemImp = (ws: string, u = A) =>
    comUsuario(u, async (tx) => (await tx.select().from(importacoes).where(eq(importacoes.workspaceId, ws))).length)

  async function novoWorkspace(u: string, nome: string) {
    const r = await comUsuario(u, (tx) => tx.execute(sql`select criar_workspace(${nome}, 'pessoal') as id`))
    return (r.rows[0] as { id: string }).id
  }
  const novaConta = async (u: string, ws: string, nome: string) =>
    (await criarContaDoUsuario(u, ws, contaSchema.parse({ nome, tipo: 'corrente', saldoInicial: '' }))).id

  beforeAll(async () => {
    try {
      ids = await criarUsuariosTeste(2)
      ;[A, B] = ids
      wsA = await novoWorkspace(A, 'Casa A')
      wsB = await novoWorkspace(B, 'Casa B')
      contaA = await novaConta(A, wsA, 'Corrente')
      contaA2 = await novaConta(A, wsA, 'Cartão')
      contaB = await novaConta(B, wsB, 'Conta B')
      catA = (await listarCategoriasDoUsuario(A, wsA)).find((c) => c.nome === 'Alimentação')!.id
      catB = (await listarCategoriasDoUsuario(B, wsB))[0].id
    } catch (e) {
      await apagarUsuariosTeste(ids)
      throw e
    }
  })

  afterAll(async () => {
    await apagarUsuariosTeste(ids)
  })

  describe('importar_lancamentos / desfazer_importacao', () => {
    it('importa, reimporta sem duplicar (sem importação vazia) e desfaz', async () => {
      const ls = linhas(3, 'basico')
      const r1 = await importar(A, wsA, contaA, ls)
      expect(r1.inseridos).toBe(3)
      expect(r1.ignorados).toBe(0)
      expect(r1.importacao_id).toBeTruthy()

      const imps = await comUsuario(A, (tx) => tx.select().from(importacoes).where(eq(importacoes.id, r1.importacao_id!)))
      expect(imps[0]).toMatchObject({ qtdLancamentos: 3, formato: 'csv', arquivoNome: 'a.csv', contaId: contaA })
      const gravados = await comUsuario(A, (tx) =>
        tx.select().from(lancamentos).where(eq(lancamentos.importacaoId, r1.importacao_id!)),
      )
      expect(gravados).toHaveLength(3)
      expect(gravados.every((l) => l.status === 'efetivado' && l.workspaceId === wsA && l.contaId === contaA)).toBe(true)
      expect(gravados.map((l) => l.valorCentavos).sort((a, b) => a - b)).toEqual([-300, -200, -100])

      const antes = await contagemImp(wsA)
      const r2 = await importar(A, wsA, contaA, ls)
      expect(r2).toEqual({ importacao_id: null, inseridos: 0, ignorados: 3 })
      expect(await contagemImp(wsA)).toBe(antes)

      await comUsuario(A, (tx) => tx.execute(sql`select desfazer_importacao(${r1.importacao_id}::uuid)`))
      expect(await contagemLanc(contaA)).toBe(0)
      expect(await contagemImp(wsA)).toBe(antes - 1)
    })

    it('sobreposição parcial: só as novas entram; duplicata dentro do mesmo envio conta como ignorada', async () => {
      await importar(A, wsA, contaA, linhas(2, 'parc'))
      const r = await importar(A, wsA, contaA, [...linhas(3, 'parc'), { ...linhas(1, 'parc')[0] }])
      expect(r.inseridos).toBe(1)
      expect(r.ignorados).toBe(3)
      expect(await contagemLanc(contaA)).toBe(3)
      // mesma idExterno em outra conta é permitido (unique é por conta)
      const r3 = await importar(A, wsA, contaA2, linhas(2, 'parc'))
      expect(r3.inseridos).toBe(2)
    })

    it('desfazer apaga só os lançamentos da importação, preservando os demais da conta', async () => {
      const manual = await comUsuario(A, (tx) =>
        tx
          .insert(lancamentos)
          .values({ workspaceId: wsA, contaId: contaA, data: '2026-03-01', descricao: 'Manual', valorCentavos: -1 })
          .returning({ id: lancamentos.id }),
      )
      const r = await importar(A, wsA, contaA, linhas(2, 'des'))
      await desfazerImportacaoDoUsuario(A, wsA, r.importacao_id!)
      const resto = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.id, manual[0].id)))
      expect(resto).toHaveLength(1)
      // desfazer duas vezes: não encontrada
      const e = await desfazerImportacaoDoUsuario(A, wsA, r.importacao_id!).catch((x) => x)
      expect(e).toBeInstanceOf(ErroDominio)
      expect((e as ErroDominio).chave).toBe('importacao.erros.importacaoNaoEncontrada')
    })

    it('usuário B não importa no workspace/conta de A nem desfaz importação de A', async () => {
      const r = await importar(A, wsA, contaA, linhas(2, 'iso'))
      const antes = await contagemLanc(contaA)
      // workspace de A, conta de A
      expect(await codigoDe(importar(B, wsA, contaA, linhas(1, 'inv')))).toBe('42501')
      // workspace de B, conta de A
      expect(await codigoDe(importar(B, wsB, contaA, linhas(1, 'inv')))).toBe('22023')
      // desfazer direto na função: RLS esconde a importação
      expect(await codigoDe(comUsuario(B, (tx) => tx.execute(sql`select desfazer_importacao(${r.importacao_id}::uuid)`)))).toBe('P0002')
      expect(await contagemLanc(contaA)).toBe(antes)
      // pela camada de serviço também
      await expect(desfazerImportacaoDoUsuario(B, wsA, r.importacao_id!)).rejects.toBeInstanceOf(ErroDominio)
      // B não vê o histórico de A
      expect(await listarImportacoesDoUsuario(B, wsA)).toEqual([])
    })

    it('conta de outro workspace é rejeitada (mesmo sendo membro dos dois)', async () => {
      // A também é membro de um segundo workspace próprio
      const ws2 = await novoWorkspace(A, 'Segundo A')
      const conta2 = await novaConta(A, ws2, 'Outra')
      expect(await codigoDe(importar(A, wsA, conta2, linhas(1, 'cx')))).toBe('22023')
      expect(await codigoDe(importar(A, ws2, contaA, linhas(1, 'cx')))).toBe('22023')
    })

    it('categoriaId de outro workspace aborta tudo; do próprio workspace é gravada', async () => {
      const antes = await contagemLanc(contaA)
      const ruim = [...linhas(2, 'cat'), { ...linhas(1, 'cat9')[0], categoriaId: catB }]
      expect(await codigoDe(importar(A, wsA, contaA, ruim))).toBe('22023')
      expect(await contagemLanc(contaA)).toBe(antes)

      const r = await importar(A, wsA, contaA, [{ ...linhas(1, 'cat-ok')[0], categoriaId: catA }])
      expect(r.inseridos).toBe(1)
      const l = await comUsuario(A, (tx) =>
        tx.select().from(lancamentos).where(and(eq(lancamentos.contaId, contaA), eq(lancamentos.idExterno, 'cat-ok-1'))),
      )
      expect(l[0].categoriaId).toBe(catA)
    })

    it('uma linha inválida aborta TUDO: nada inserido e nenhuma importação criada', async () => {
      const antesL = await contagemLanc(contaA)
      const antesI = await contagemImp(wsA)
      const base = linhas(2, 'abort')
      const invalidas: [string, Record<string, unknown>][] = [
        ['valor zero', { valorCentavos: 0 }],
        ['valor fracionário', { valorCentavos: 1.5 }],
        ['valor texto', { valorCentavos: '10' }],
        ['data impossível', { data: '2026-02-31' }],
        ['data fora do formato', { data: '15/03/2026' }],
        ['descrição vazia', { descricao: '  ' }],
        ['idExterno vazio', { idExterno: '' }],
        ['categoria não uuid', { categoriaId: 'abc' }],
      ]
      for (const [nome, parcial] of invalidas) {
        const cod = await codigoDe(importar(A, wsA, contaA, [...base, { ...base[0], idExterno: 'abort-ruim', ...parcial }]))
        expect(cod, nome).toBe('22023')
      }
      expect(await codigoDe(importar(A, wsA, contaA, [...base, 'texto']))).toBe('22023')
      expect(await contagemLanc(contaA)).toBe(antesL)
      expect(await contagemImp(wsA)).toBe(antesI)
    })

    it('valida parâmetros: array vazio, não-array, mais de 5000, formato, arquivo', async () => {
      expect(await codigoDe(importar(A, wsA, contaA, []))).toBe('22023')
      expect(await codigoDe(importar(A, wsA, contaA, { a: 1 }))).toBe('22023')
      const muitas = Array.from({ length: 5001 }, (_, i) => ({ ...linhas(1)[0], idExterno: `m-${i}` }))
      expect(await codigoDe(importar(A, wsA, contaA, muitas))).toBe('22023')
      expect(await codigoDe(importar(A, wsA, contaA, linhas(1, 'f'), 'pdf'))).toBe('22023')
      expect(await codigoDe(importar(A, wsA, contaA, linhas(1, 'f'), 'csv', '   '))).toBe('22023')
    })

    it('exatamente 5000 linhas é aceito', async () => {
      const conta = await novaConta(A, wsA, 'Grande')
      const cinco = Array.from({ length: 5000 }, (_, i) => ({ ...linhas(1)[0], idExterno: `g-${i}` }))
      const r = await importar(A, wsA, conta, cinco)
      expect(r.inseridos).toBe(5000)
    })

    it('sem usuário na transação (sem comUsuario) falha fechado', async () => {
      const cod = await codigoDe(
        db.execute(sql`select * from importar_lancamentos(${wsA}::uuid, ${contaA}::uuid, 'a.csv', 'csv', '[]'::jsonb)`),
      )
      expect(cod).toBe('28000')
    })

    it('execute só para app_user (nada para PUBLIC) e security invoker', async () => {
      const r = await db.execute(
        sql`select p.proname, p.prosecdef, coalesce(p.proacl::text, '') as acl
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('importar_lancamentos', 'desfazer_importacao')`,
      )
      expect(r.rows).toHaveLength(2)
      for (const f of r.rows as { prosecdef: boolean; acl: string }[]) {
        expect(f.prosecdef).toBe(false)
        expect(f.acl).toContain('app_user=X/')
        expect(f.acl).not.toMatch(/(^|,)=X\//) // grantee vazio = PUBLIC
      }
    })
  })

  describe('fluxo de serviço (prévia -> confirmar)', () => {
    async function fluxo(
      u: string,
      ws: string,
      conta: string,
      bytes: Uint8Array,
      ext: 'ofx' | 'csv',
      nome: string,
      mapeamento: MapeamentoCsv | null = null,
      aoMontar?: (p: Previa) => void,
    ) {
      const previa = await previaImportacaoDoUsuario(u, ws, conta, { bytes, extensao: ext }, mapeamento)
      aoMontar?.(previa)
      const novas = previa.linhas.filter((l) => !l.duplicado)
      if (novas.length === 0) return { previa, resultado: null }
      const entrada = confirmarSchema.parse({
        workspaceId: ws,
        contaId: conta,
        arquivo: nome,
        formato: previa.formato,
        linhas: novas.map((l) => ({
          data: l.data,
          descricao: l.descricao,
          valorCentavos: l.valorCentavos,
          idExterno: l.idExterno,
          categoriaId: l.categoriaId,
        })),
        mapeamento,
      })
      return { previa, resultado: await confirmarImportacaoDoUsuario(u, entrada) }
    }

    it('dois cafés idênticos no mesmo dia: ambos entram; reimportar não duplica', async () => {
      const conta = await novaConta(A, wsA, 'Cafés')
      const csv = enc('Data;Descrição;Valor\n15/03/2026;CAFE;-5,00\n15/03/2026;CAFE;-5,00\n')
      const r1 = await fluxo(A, wsA, conta, csv, 'csv', 'cafes.csv', MAP)
      expect(r1.resultado).toMatchObject({ inseridos: 2, ignorados: 0 })
      expect(await contagemLanc(conta)).toBe(2)

      const r2 = await fluxo(A, wsA, conta, csv, 'csv', 'cafes.csv', MAP)
      expect(r2.previa.linhas.map((l) => l.duplicado)).toEqual([true, true])
      expect(r2.resultado).toBeNull()
      // mesmo ignorando a prévia e enviando tudo de novo, o banco não duplica
      const forcar = confirmarSchema.parse({
        workspaceId: wsA,
        contaId: conta,
        arquivo: 'cafes.csv',
        formato: 'csv',
        linhas: r2.previa.linhas,
      })
      expect(await confirmarImportacaoDoUsuario(A, forcar)).toEqual({ importacaoId: null, inseridos: 0, ignorados: 2 })
      expect(await contagemLanc(conta)).toBe(2)
    })

    it('Itaú Latin-1: acentos preservados no banco; reimportação marca tudo como duplicado', async () => {
      const conta = await novaConta(A, wsA, 'Itaú')
      const r1 = await fluxo(A, wsA, conta, fixture('itau.ofx'), 'ofx', 'itau.ofx')
      expect(r1.previa.formato).toBe('ofx')
      expect(r1.resultado).toMatchObject({ inseridos: 3, ignorados: 0 })
      const descs = (
        await comUsuario(A, (tx) => tx.select({ d: lancamentos.descricao }).from(lancamentos).where(eq(lancamentos.contaId, conta)))
      ).map((x) => x.d)
      expect(descs).toContain('PADARIA SÃO JOSÉ')
      expect(descs).toContain('SALÁRIO EMPRESA FICTÍCIA')
      expect(descs.some((d) => d.includes('�'))).toBe(false)

      const r2 = await fluxo(A, wsA, conta, fixture('itau.ofx'), 'ofx', 'itau.ofx')
      expect(r2.previa.linhas.every((l) => l.duplicado)).toBe(true)
    })

    it('Nubank (XML/UTF-8) e Inter (SGML, vírgula decimal, uma linha sem FITID)', async () => {
      const cn = await novaConta(A, wsA, 'Nubank')
      const n = await fluxo(A, wsA, cn, fixture('nubank.ofx'), 'ofx', 'nubank.ofx')
      expect(n.resultado?.inseridos).toBe(3)
      const nl = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.contaId, cn)))
      expect(nl.map((l) => l.descricao)).toContain('Transferência enviada - José & Filhos Ltda')

      const ci = await novaConta(A, wsA, 'Inter')
      const i1 = await fluxo(A, wsA, ci, fixture('inter.ofx'), 'ofx', 'inter.ofx')
      expect(i1.resultado?.inseridos).toBe(3)
      const il = await comUsuario(A, (tx) => tx.select().from(lancamentos).where(eq(lancamentos.contaId, ci)))
      expect(il.map((l) => l.valorCentavos).sort((a, b) => a - b)).toEqual([-123456, -500, -500])
      const i2 = await fluxo(A, wsA, ci, fixture('inter.ofx'), 'ofx', 'inter.ofx')
      expect(i2.previa.linhas.every((l) => l.duplicado)).toBe(true) // inclusive a sem FITID (hash estável)
    })

    it('CSVs das fixtures; mapeamento é salvo na conta e devolvido na prévia seguinte', async () => {
      const conta = await novaConta(A, wsA, 'CSV')
      const sem = await fluxo(A, wsA, conta, fixture('extrato-semicolon.csv'), 'csv', 'e.csv')
      expect(sem.previa).toMatchObject({
        precisaMapeamento: true,
        colunasCsv: ['Data', 'Descrição', 'Valor'],
        mapeamentoSalvo: null,
        linhas: [],
      })

      const r = await fluxo(A, wsA, conta, fixture('extrato-semicolon.csv'), 'csv', 'e.csv', MAP)
      expect(r.previa.erros.map((e) => e.motivo).sort()).toEqual(['data inválida', 'valor inválido'])
      expect(r.resultado).toMatchObject({ inseridos: 3 })
      const salvo = await comUsuario(A, (tx) => tx.select({ m: contas.mapeamentoCsv }).from(contas).where(eq(contas.id, conta)))
      expect(salvo[0].m).toEqual(MAP)

      const de = await previaImportacaoDoUsuario(A, wsA, conta, { bytes: fixture('extrato-semicolon.csv'), extensao: 'csv' }, null)
      expect(de.mapeamentoSalvo).toEqual(MAP)

      // cartão: outro arquivo, colunas diferentes -> mapeamento salvo não se aplica
      const outro = await previaImportacaoDoUsuario(A, wsA, conta, { bytes: fixture('nubank-cartao.csv'), extensao: 'csv' }, null)
      expect(outro.mapeamentoSalvo).toBeNull()
      const cartao = await fluxo(A, wsA, await novaConta(A, wsA, 'Cartão CSV'), fixture('nubank-cartao.csv'), 'csv', 'c.csv', {
        colData: 'date',
        colDescricao: 'title',
        colValor: 'amount',
        inverterSinal: true,
      })
      expect(cartao.previa.linhas.map((l) => l.valorCentavos)).toEqual([-5000, -12035])
    })

    it('regras do workspace sugerem categoria na prévia', async () => {
      const conta = await novaConta(A, wsA, 'Regras')
      await criarRegraDoUsuario(A, wsA, regraSchema.parse({ padrao: 'padaria', categoriaId: catA, prioridade: '1' }))
      const p = await previaImportacaoDoUsuario(A, wsA, conta, { bytes: fixture('itau.ofx'), extensao: 'ofx' }, null)
      expect(p.linhas.find((l) => l.descricao.startsWith('PADARIA'))?.categoriaId).toBe(catA)
      expect(p.linhas.find((l) => l.descricao.startsWith('CAF'))?.categoriaId).toBeNull()
    })

    it('valor zero sai como erro de linha; arquivo sem transações dá erro amigável', async () => {
      const conta = await novaConta(A, wsA, 'Zero')
      const csv = enc('Data;Descrição;Valor\n15/03/2026;ZERO;0,00\n16/03/2026;OK;-1,00\n')
      const r = await fluxo(A, wsA, conta, csv, 'csv', 'z.csv', MAP)
      expect(r.previa.erros).toEqual([{ linha: 2, motivo: 'valor zero' }])
      expect(r.resultado?.inseridos).toBe(1)

      const e = await previaImportacaoDoUsuario(A, wsA, conta, { bytes: enc('OFXHEADER:100\n<OFX></OFX>'), extensao: 'ofx' }, null).catch((x) => x)
      expect((e as ErroDominio).chave).toBe('importacao.erros.semTransacoes')
    })

    it('B não faz prévia nem confirma em conta de A', async () => {
      const e = await previaImportacaoDoUsuario(B, wsA, contaA, { bytes: fixture('itau.ofx'), extensao: 'ofx' }, null).catch((x) => x)
      expect((e as ErroDominio).chave).toBe('importacao.erros.contaNaoEncontrada')
      const entrada = confirmarSchema.parse({
        workspaceId: wsA,
        contaId: contaA,
        arquivo: 'x.csv',
        formato: 'csv',
        linhas: [{ data: '2026-03-15', descricao: 'X', valorCentavos: -1, idExterno: 'inv-b' }],
      })
      await expect(confirmarImportacaoDoUsuario(B, entrada)).rejects.toBeInstanceOf(ErroDominio)
      // B importa normalmente na própria conta
      expect((await importar(B, wsB, contaB, linhas(1, 'b'))).inseridos).toBe(1)
    })

    it('histórico lista com nome da conta e desfazer pelo serviço remove tudo', async () => {
      const conta = await novaConta(A, wsA, 'Histórico')
      const r = await fluxo(A, wsA, conta, fixture('itau.ofx'), 'ofx', 'hist.ofx')
      const hist = await listarImportacoesDoUsuario(A, wsA)
      const item = hist.find((h) => h.arquivoNome === 'hist.ofx')
      expect(item).toMatchObject({ contaNome: 'Histórico', formato: 'ofx', qtdLancamentos: 3 })
      await desfazerImportacaoDoUsuario(A, wsA, item!.id)
      expect(await contagemLanc(conta)).toBe(0)
      expect((await listarImportacoesDoUsuario(A, wsA)).some((h) => h.id === item!.id)).toBe(false)
      expect(r.resultado?.importacaoId).toBe(item!.id)
    })
  })
})
