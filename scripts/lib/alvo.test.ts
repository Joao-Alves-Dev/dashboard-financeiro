import { describe, expect, it } from 'vitest'
import {
  avaliarAlvo,
  confirmacaoValida,
  hostDe,
  lerArgs,
  normalizarEmail,
  validarNomeWorkspace,
} from './alvo'

describe('lerArgs', () => {
  it('usa o padrão sem --arquivo', () => {
    expect(lerArgs([], '.env.local')).toEqual({ arquivo: '.env.local', posicionais: [] })
  })
  it('lê --arquivo e --arquivo=', () => {
    expect(lerArgs(['--arquivo', 'x.env'], '.env.local').arquivo).toBe('x.env')
    expect(lerArgs(['--arquivo=y.env'], '.env.local').arquivo).toBe('y.env')
  })
  it('separa posicionais', () => {
    expect(lerArgs(['CHAVE', '--arquivo', 'x.env'], '.env.local')).toEqual({ arquivo: 'x.env', posicionais: ['CHAVE'] })
  })
  it('falha sem valor ou com opção desconhecida', () => {
    expect(() => lerArgs(['--arquivo'], 'a')).toThrow(/caminho/)
    expect(() => lerArgs(['--arquivo', '--outra'], 'a')).toThrow(/caminho/)
    expect(() => lerArgs(['--senha=1'], 'a')).toThrow(/desconhecida/)
  })
})

describe('avaliarAlvo', () => {
  it('dev em .env.local: sem confirmação', () => {
    expect(avaliarAlvo('dev', '.env.local')).toEqual({ ok: true, branch: 'dev', exigeConfirmacao: false })
  })
  it('production no arquivo de produção: exige confirmação', () => {
    expect(avaliarAlvo('production', '.env.production.local')).toEqual({
      ok: true,
      branch: 'production',
      exigeConfirmacao: true,
    })
  })
  it('recusa branch ausente', () => {
    expect(avaliarAlvo(undefined, '.env.local').ok).toBe(false)
    expect(avaliarAlvo('  ', '.env.local').ok).toBe(false)
  })
  it('recusa arquivo de produção apontando para outra branch, e o inverso', () => {
    expect(avaliarAlvo('dev', '.env.production.local').ok).toBe(false)
    expect(avaliarAlvo('production', '.env.local').ok).toBe(false)
  })
})

describe('confirmacaoValida', () => {
  it('exige o nome exato da branch', () => {
    expect(confirmacaoValida('production', 'production')).toBe(true)
    expect(confirmacaoValida(' production \n', 'production')).toBe(true)
    expect(confirmacaoValida('Production', 'production')).toBe(false)
    expect(confirmacaoValida('', 'production')).toBe(false)
    expect(confirmacaoValida('sim', 'production')).toBe(false)
  })
})

describe('hostDe', () => {
  it('devolve só o host', () => {
    expect(hostDe('postgresql://u:senha@ep-abc.us-east-2.aws.neon.tech/db?sslmode=require')).toBe(
      'ep-abc.us-east-2.aws.neon.tech',
    )
    expect(hostDe('lixo')).toBeNull()
    expect(hostDe(undefined)).toBeNull()
  })
})

describe('validarNomeWorkspace / normalizarEmail', () => {
  it('valida tamanho e apara espaços', () => {
    expect(validarNomeWorkspace('  Pai ')).toEqual({ ok: true, nome: 'Pai' })
    expect(validarNomeWorkspace('a').ok).toBe(false)
    expect(validarNomeWorkspace('x'.repeat(61)).ok).toBe(false)
  })
  it('normaliza e-mail', () => {
    expect(normalizarEmail('  Joao@Exemplo.COM ')).toBe('joao@exemplo.com')
  })
})
