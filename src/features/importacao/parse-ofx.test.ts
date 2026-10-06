import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodificarArquivo } from './decodificar'
import { parseOfx } from './parse-ofx'

const bytes = (n: string) => new Uint8Array(readFileSync(join(__dirname, '__fixtures__', n)))
const carregar = (n: string) => decodificarArquivo(bytes(n))

const ofx = (...trns: string[]) =>
  `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>${trns.join('')}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
const trn = (campos: string) => `<STMTTRN>${campos}</STMTTRN>`

describe('decodificarArquivo', () => {
  it('fixture itau.ofx é Latin-1 de verdade (não é UTF-8 válido)', () => {
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes('itau.ofx'))).toThrow()
  })
  it('Latin-1: preserva acentos sem U+FFFD', () => {
    const texto = carregar('itau.ofx')
    expect(texto).toContain('PADARIA SÃO JOSÉ')
    expect(texto).not.toContain('�')
  })
  it('UTF-8 válido é decodificado como UTF-8', () => {
    expect(decodificarArquivo(new TextEncoder().encode('PADARIA SÃO JOSÉ'))).toBe('PADARIA SÃO JOSÉ')
  })
})

describe('parseOfx - Itaú (SGML 1.x, Latin-1)', () => {
  it('lê as transações, descrição Latin-1 exata e data sem deslocamento de fuso', () => {
    const r = parseOfx(carregar('itau.ofx'))
    expect(r.erros).toEqual([])
    expect(r.linhas).toEqual([
      { linha: 1, data: '2026-03-15', descricao: 'PADARIA SÃO JOSÉ', valorCentavos: -123456, idExterno: '202603150001' },
      { linha: 2, data: '2026-03-16', descricao: 'CAFÉ DA ESQUINA', valorCentavos: -500, idExterno: '202603160001' },
      { linha: 3, data: '2026-12-31', descricao: 'SALÁRIO EMPRESA FICTÍCIA', valorCentavos: 350000, idExterno: '202612310001' },
    ])
  })
  it('DTPOSTED com hora e fuso vira só a data', () => {
    const r = parseOfx(ofx(trn('<DTPOSTED>20260315120000[-3:BRT]<TRNAMT>-1.00<FITID>1<MEMO>X')))
    expect(r.linhas[0].data).toBe('2026-03-15')
  })
})

describe('parseOfx - Nubank (XML 2.x, UTF-8)', () => {
  it('lê tags fechadas e decodifica entidades XML', () => {
    const r = parseOfx(carregar('nubank.ofx'))
    expect(r.erros).toEqual([])
    expect(r.linhas).toHaveLength(3)
    expect(r.linhas[0]).toEqual({
      linha: 1,
      data: '2026-03-15',
      descricao: 'Transferência enviada - José & Filhos Ltda',
      valorCentavos: -5000,
      idExterno: 'a1b2c3d4-0001',
    })
    expect(r.linhas[1].valorCentavos).toBe(150000)
  })
})

describe('parseOfx - Inter', () => {
  it('vírgula decimal, NAME quando MEMO vazio, sem FITID', () => {
    const r = parseOfx(carregar('inter.ofx'))
    expect(r.erros).toEqual([])
    expect(r.linhas.map((l) => [l.descricao, l.valorCentavos, l.idExterno])).toEqual([
      ['Pix para Fulano de Tal', -123456, 'INT0001'],
      ['COMPRA CARTAO MERCADO EXEMPLO', -500, 'INT0002'],
      ['Compra sem FITID', -500, undefined],
    ])
  })
})

describe('parseOfx - valores', () => {
  const valor = (v: string) =>
    parseOfx(ofx(trn(`<DTPOSTED>20260315<TRNAMT>${v}<MEMO>X`))).linhas[0]?.valorCentavos
  it('ponto e vírgula decimais resultam no mesmo número de centavos', () => {
    expect(valor('-1234.56')).toBe(-123456)
    expect(valor('-1234,56')).toBe(-123456)
  })
  it('milhar com decimal em ambos os estilos', () => {
    expect(valor('-1,234.56')).toBe(-123456)
    expect(valor('-1.234,56')).toBe(-123456)
  })
  it('inteiros, 1 casa decimal e sinal +', () => {
    expect(valor('100')).toBe(10000)
    expect(valor('+7.5')).toBe(750)
    expect(valor('-0.29')).toBe(-29)
  })
  it('zeros extras à direita são tolerados', () => {
    expect(valor('12.500')).toBe(1250)
  })
  it('valor inválido vai para erros', () => {
    const r = parseOfx(ofx(trn('<DTPOSTED>20260315<TRNAMT>abc<MEMO>X')))
    expect(r.linhas).toEqual([])
    expect(r.erros).toEqual([{ linha: 1, motivo: 'valor inválido' }])
  })
})

describe('parseOfx - descrição, FITID e datas', () => {
  it('descrição = MEMO; se vazio, NAME', () => {
    const r = parseOfx(
      ofx(
        trn('<DTPOSTED>20260315<TRNAMT>-1.00<MEMO>memo aqui<NAME>nome aqui'),
        trn('<DTPOSTED>20260315<TRNAMT>-1.00<MEMO><NAME>nome aqui'),
      ),
    )
    expect(r.linhas.map((l) => l.descricao)).toEqual(['memo aqui', 'nome aqui'])
  })
  it('STMTTRN sem FITID -> idExterno indefinido', () => {
    const r = parseOfx(ofx(trn('<DTPOSTED>20260315<TRNAMT>-1.00<MEMO>X')))
    expect(r.linhas[0].idExterno).toBeUndefined()
    expect('idExterno' in r.linhas[0]).toBe(false)
  })
  it('data inválida e descrição vazia vão para erros; as demais seguem', () => {
    const r = parseOfx(
      ofx(
        trn('<DTPOSTED>20260231<TRNAMT>-1.00<MEMO>X'),
        trn('<DTPOSTED>20260301<TRNAMT>-1.00<MEMO><NAME>'),
        trn('<DTPOSTED>20260302<TRNAMT>-1.00<MEMO>ok'),
      ),
    )
    expect(r.erros).toEqual([
      { linha: 1, motivo: 'data inválida' },
      { linha: 2, motivo: 'descrição vazia' },
    ])
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].linha).toBe(3)
  })
  it('SGML sem </STMTTRN> também funciona', () => {
    const r = parseOfx(
      '<BANKTRANLIST><STMTTRN><DTPOSTED>20260301<TRNAMT>-1.00<MEMO>A<STMTTRN><DTPOSTED>20260302<TRNAMT>-2.00<MEMO>B</BANKTRANLIST>',
    )
    expect(r.linhas.map((l) => l.descricao)).toEqual(['A', 'B'])
  })
  it('texto sem transações devolve resultado vazio', () => {
    expect(parseOfx('nada aqui')).toEqual({ linhas: [], erros: [] })
  })
})
