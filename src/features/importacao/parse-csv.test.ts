import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectarColunasCsv, parseCsv } from './parse-csv'
import type { MapeamentoCsv } from './tipos'

const fx = (n: string) => readFileSync(join(__dirname, '__fixtures__', n), 'utf-8')

const mapPt: MapeamentoCsv = {
  colData: 'Data',
  colDescricao: 'Descrição',
  colValor: 'Valor',
  inverterSinal: false,
}

describe('detectarColunasCsv', () => {
  it('detecta separador ponto e vírgula', () => {
    expect(detectarColunasCsv(fx('extrato-semicolon.csv'))).toEqual(['Data', 'Descrição', 'Valor'])
  })
  it('detecta separador vírgula', () => {
    expect(detectarColunasCsv(fx('nubank-cartao.csv'))).toEqual(['date', 'title', 'amount'])
  })
  it('BOM inicial não aparece no nome da primeira coluna', () => {
    const texto = fx('extrato-semicolon.csv')
    expect(texto.charCodeAt(0)).toBe(0xfeff)
    expect(detectarColunasCsv(texto)[0]).toBe('Data')
  })
  it('texto vazio devolve lista vazia', () => {
    expect(detectarColunasCsv('')).toEqual([])
  })
})

describe('parseCsv', () => {
  it('converte dd/mm/aaaa e valores BR; linhas inválidas vão para erros', () => {
    const r = parseCsv(fx('extrato-semicolon.csv'), mapPt)
    expect(r.linhas).toEqual([
      { linha: 2, data: '2026-03-15', descricao: 'PADARIA SAO JOSE', valorCentavos: -123456 },
      { linha: 3, data: '2026-12-31', descricao: 'SUPERMERCADO EXEMPLO', valorCentavos: -8990 },
      { linha: 4, data: '2027-01-01', descricao: 'SALARIO EMPRESA FICTICIA', valorCentavos: 500000 },
    ])
    expect(r.erros).toEqual([
      { linha: 5, motivo: 'data inválida' },
      { linha: 6, motivo: 'valor inválido' },
    ])
  })
  it('aceita data ISO e separador vírgula com campo entre aspas', () => {
    const r = parseCsv(fx('nubank-cartao.csv'), {
      colData: 'date',
      colDescricao: 'title',
      colValor: 'amount',
      inverterSinal: false,
    })
    expect(r.erros).toEqual([])
    expect(r.linhas.map((l) => [l.data, l.descricao, l.valorCentavos])).toEqual([
      ['2026-03-15', 'Uber *Trip', 5000],
      ['2026-03-16', 'Mercado, Centro', 12035],
    ])
  })
  it('inverterSinal transforma compras positivas em saídas', () => {
    const r = parseCsv('data;desc;valor\n15/03/2026;Loja;50,00\n', {
      colData: 'data',
      colDescricao: 'desc',
      colValor: 'valor',
      inverterSinal: true,
    })
    expect(r.linhas[0].valorCentavos).toBe(-5000)
  })
  it('inverterSinal com valor zero não produz -0', () => {
    const r = parseCsv('data;desc;valor\n15/03/2026;Loja;0,00\n', {
      colData: 'data',
      colDescricao: 'desc',
      colValor: 'valor',
      inverterSinal: true,
    })
    expect(Object.is(r.linhas[0].valorCentavos, 0)).toBe(true)
  })
  it('datas de fronteira: 29/02 só em ano bissexto', () => {
    const r = parseCsv('data;desc;valor\n29/02/2028;A;1,00\n29/02/2027;B;1,00\n', {
      colData: 'data',
      colDescricao: 'desc',
      colValor: 'valor',
      inverterSinal: false,
    })
    expect(r.linhas.map((l) => l.data)).toEqual(['2028-02-29'])
    expect(r.erros).toEqual([{ linha: 3, motivo: 'data inválida' }])
  })
  it('coluna mapeada inexistente gera erro único', () => {
    const r = parseCsv('a;b;c\n1;2;3\n', { ...mapPt })
    expect(r.linhas).toEqual([])
    expect(r.erros).toEqual([{ linha: 1, motivo: 'coluna não encontrada: Data' }])
  })
  it('ignora linhas em branco', () => {
    const r = parseCsv('data;desc;valor\n\n15/03/2026;Loja;1,00\n\n', {
      colData: 'data',
      colDescricao: 'desc',
      colValor: 'valor',
      inverterSinal: false,
    })
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].linha).toBe(3)
    expect(r.erros).toEqual([])
  })
})
