import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ErroDominio } from '@/lib/erro-dominio'
import { prepararArquivo } from './preparar'
import type { MapeamentoCsv } from './tipos'

const fixture = (n: string) => new Uint8Array(readFileSync(join(__dirname, '__fixtures__', n)))
const enc = (s: string) => new TextEncoder().encode(s)
const M: MapeamentoCsv = { colData: 'Data', colDescricao: 'Descrição', colValor: 'Valor', inverterSinal: false }

function erroDe(fn: () => unknown): ErroDominio {
  try {
    fn()
  } catch (e) {
    if (e instanceof ErroDominio) return e
    throw e
  }
  throw new Error('não lançou')
}

describe('prepararArquivo', () => {
  it('Itaú Latin-1: acentos preservados e FITID mantido', () => {
    const r = prepararArquivo(fixture('itau.ofx'), 'ofx', null)
    if (r.tipo !== 'ok') throw new Error('esperava ok')
    expect(r.formato).toBe('ofx')
    expect(r.linhas.map((l) => l.descricao)).toContain('PADARIA SÃO JOSÉ')
    expect(r.linhas.some((l) => l.descricao.includes('�'))).toBe(false)
    expect(r.linhas[0].idExterno).toBe('202603150001')
  })

  it('OFX sem FITID recebe hash (inter)', () => {
    const r = prepararArquivo(fixture('inter.ofx'), 'ofx', null)
    if (r.tipo !== 'ok') throw new Error('esperava ok')
    expect(r.linhas).toHaveLength(3)
    expect(r.linhas.filter((l) => l.idExterno.startsWith('csv:'))).toHaveLength(1)
  })

  it('CSV sem mapeamento devolve só as colunas', () => {
    const r = prepararArquivo(fixture('extrato-semicolon.csv'), 'csv', null)
    expect(r).toEqual({ tipo: 'precisa_mapeamento', formato: 'csv', colunas: ['Data', 'Descrição', 'Valor'] })
  })

  it('CSV com mapeamento: linhas válidas e erros por linha', () => {
    const r = prepararArquivo(fixture('extrato-semicolon.csv'), 'csv', M)
    if (r.tipo !== 'ok') throw new Error('esperava ok')
    expect(r.linhas).toHaveLength(3)
    expect(r.erros.map((e) => e.motivo).sort()).toEqual(['data inválida', 'valor inválido'])
  })

  it('dois cafés idênticos no mesmo arquivo recebem ids distintos e estáveis', () => {
    const csv = 'Data;Descrição;Valor\n15/03/2026;CAFE;-5,00\n15/03/2026;CAFE;-5,00\n'
    const a = prepararArquivo(enc(csv), 'csv', M)
    const b = prepararArquivo(enc(csv), 'csv', M)
    if (a.tipo !== 'ok' || b.tipo !== 'ok') throw new Error('esperava ok')
    expect(a.linhas).toHaveLength(2)
    expect(a.linhas[0].idExterno).not.toBe(a.linhas[1].idExterno)
    expect(a.linhas.map((l) => l.idExterno)).toEqual(b.linhas.map((l) => l.idExterno))
  })

  it('valor zero vira erro de linha', () => {
    const csv = 'Data;Descrição;Valor\n15/03/2026;ZERO;0,00\n16/03/2026;OK;-1,00\n'
    const r = prepararArquivo(enc(csv), 'csv', M)
    if (r.tipo !== 'ok') throw new Error('esperava ok')
    expect(r.linhas).toHaveLength(1)
    expect(r.erros).toEqual([{ linha: 2, motivo: 'valor zero' }])
  })

  it('descrição acima de 200 caracteres é cortada', () => {
    const csv = `Data;Descrição;Valor\n15/03/2026;${'A'.repeat(300)};-1,00\n`
    const r = prepararArquivo(enc(csv), 'csv', M)
    if (r.tipo !== 'ok') throw new Error('esperava ok')
    expect(r.linhas[0].descricao).toHaveLength(200)
  })

  it.each([
    ['arquivo vazio', enc('  \n '), 'ofx', 'importacao.erros.arquivoVazio'],
    ['.ofx que não é OFX', enc('a;b\n1;2'), 'ofx', 'importacao.erros.naoOfx'],
    ['OFX sem transações', enc('OFXHEADER:100\n<OFX></OFX>'), 'ofx', 'importacao.erros.semTransacoes'],
    ['CSV só com cabeçalho', enc('Data;Descrição;Valor\n'), 'csv', 'importacao.erros.semTransacoes'],
  ] as const)('erro amigável: %s', (_n, bytes, ext, chave) => {
    expect(erroDe(() => prepararArquivo(bytes, ext, M)).chave).toBe(chave)
  })

  it('coluna do mapeamento inexistente no arquivo', () => {
    const e = erroDe(() => prepararArquivo(fixture('nubank-cartao.csv'), 'csv', M))
    expect(e.chave).toBe('importacao.erros.colunaInexistente')
    expect(e.params).toEqual({ coluna: 'Data' })
  })

  it('mais de 5000 linhas válidas', () => {
    let csv = 'Data;Descrição;Valor\n'
    for (let i = 0; i < 5001; i++) csv += `15/03/2026;L${i};-1,00\n`
    expect(erroDe(() => prepararArquivo(enc(csv), 'csv', M)).chave).toBe('importacao.erros.muitasLinhas')
  })
})
