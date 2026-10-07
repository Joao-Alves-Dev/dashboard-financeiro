import { describe, expect, it } from 'vitest'
import {
  TAMANHO_MAX_BYTES,
  confirmarSchema,
  detectarFormato,
  linhaConfirmacaoSchema,
  validarArquivoUpload,
} from './schemas'

const UUID = '3f2b8c1e-9d4a-4b7e-8a1c-0123456789ab'

describe('validarArquivoUpload', () => {
  it('aceita .ofx e .csv em qualquer caixa', () => {
    expect(validarArquivoUpload('extrato.OFX', 100)).toEqual({ ok: true, extensao: 'ofx' })
    expect(validarArquivoUpload('a.b.csv', 100)).toEqual({ ok: true, extensao: 'csv' })
  })
  it('recusa extensão desconhecida ou ausente', () => {
    expect(validarArquivoUpload('extrato.pdf', 100)).toEqual({ ok: false, chave: 'importacao.erros.extensao' })
    expect(validarArquivoUpload('extrato', 100)).toEqual({ ok: false, chave: 'importacao.erros.extensao' })
    expect(validarArquivoUpload('x.csv.exe', 100)).toEqual({ ok: false, chave: 'importacao.erros.extensao' })
  })
  it('recusa vazio e acima de 2 MB; aceita exatamente 2 MB', () => {
    expect(validarArquivoUpload('a.csv', 0)).toEqual({ ok: false, chave: 'importacao.erros.arquivoVazio' })
    expect(validarArquivoUpload('a.csv', TAMANHO_MAX_BYTES + 1)).toEqual({ ok: false, chave: 'importacao.erros.tamanho' })
    expect(validarArquivoUpload('a.csv', TAMANHO_MAX_BYTES).ok).toBe(true)
  })
})

describe('detectarFormato', () => {
  it('OFX por cabeçalho SGML ou tag XML', () => {
    expect(detectarFormato('ofx', 'OFXHEADER:100\nDATA:OFXSGML')).toBe('ofx')
    expect(detectarFormato('ofx', '<?xml version="1.0"?><OFX><SIGNONMSGSRSV1/></OFX>')).toBe('ofx')
  })
  it('.ofx sem conteúdo OFX é recusado', () => {
    expect(detectarFormato('ofx', 'Data;Valor\n01/01/2026;1,00')).toBeNull()
  })
  it('.csv com conteúdo OFX vira ofx; csv comum fica csv', () => {
    expect(detectarFormato('csv', '<OFX>\n<STMTTRN>')).toBe('ofx')
    expect(detectarFormato('csv', 'Data;Valor\n01/01/2026;1,00')).toBe('csv')
  })
})

describe('linhaConfirmacaoSchema', () => {
  const ok = { data: '2026-03-15', descricao: ' Café ', valorCentavos: -500, idExterno: 'csv:abc' }
  it('aceita e normaliza', () => {
    expect(linhaConfirmacaoSchema.parse(ok)).toEqual({ ...ok, descricao: 'Café', categoriaId: null })
    expect(linhaConfirmacaoSchema.parse({ ...ok, categoriaId: UUID }).categoriaId).toBe(UUID)
  })
  it.each([
    ['data impossível', { data: '2026-02-31' }],
    ['data fora do formato', { data: '15/03/2026' }],
    ['valor zero', { valorCentavos: 0 }],
    ['valor fracionário', { valorCentavos: 10.5 }],
    ['valor string', { valorCentavos: '10' }],
    ['descrição vazia', { descricao: '   ' }],
    ['idExterno vazio', { idExterno: '' }],
    ['categoria inválida', { categoriaId: 'nao-uuid' }],
  ])('rejeita %s', (_nome, parcial) => {
    expect(linhaConfirmacaoSchema.safeParse({ ...ok, ...parcial }).success).toBe(false)
  })
})

describe('confirmarSchema', () => {
  const linha = { data: '2026-03-15', descricao: 'X', valorCentavos: -1, idExterno: 'a' }
  const base = { workspaceId: UUID, contaId: UUID, arquivo: 'a.csv', formato: 'csv', linhas: [linha] }
  it('aceita o mínimo e mapeamento opcional', () => {
    const r = confirmarSchema.parse(base)
    expect(r.mapeamento).toBeNull()
    expect(
      confirmarSchema.parse({
        ...base,
        mapeamento: { colData: 'D', colDescricao: 'E', colValor: 'V', inverterSinal: true },
      }).mapeamento?.inverterSinal,
    ).toBe(true)
  })
  it('rejeita lista vazia, mais de 5000 linhas, formato e ids inválidos', () => {
    expect(confirmarSchema.safeParse({ ...base, linhas: [] }).success).toBe(false)
    expect(confirmarSchema.safeParse({ ...base, linhas: Array(5001).fill(linha) }).success).toBe(false)
    expect(confirmarSchema.safeParse({ ...base, formato: 'pdf' }).success).toBe(false)
    expect(confirmarSchema.safeParse({ ...base, contaId: 'x' }).success).toBe(false)
  })
})
