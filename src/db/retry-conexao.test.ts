import { describe, expect, it, vi } from 'vitest'
import { comRetryAntesDeIniciar, ehErroDeConexao } from './retry-conexao'

const erroConexao = () => new Error('Connection terminated unexpectedly')

describe('ehErroDeConexao', () => {
  it('reconhece a mensagem do driver', () => {
    expect(ehErroDeConexao(erroConexao())).toBe(true)
    expect(ehErroDeConexao(new Error('read ECONNRESET'))).toBe(true)
  })

  it('reconhece o erro embrulhado em cause (como o Drizzle faz)', () => {
    const embrulhado = new Error('Failed query: select 1', { cause: erroConexao() })
    expect(ehErroDeConexao(embrulhado)).toBe(true)
  })

  it('não confunde erros de dados ou de permissão com erro de conexão', () => {
    expect(ehErroDeConexao(new Error('duplicate key value violates unique constraint'))).toBe(false)
    expect(ehErroDeConexao(Object.assign(new Error('permission denied'), { code: '42501' }))).toBe(false)
    expect(ehErroDeConexao(undefined)).toBe(false)
    expect(ehErroDeConexao('texto')).toBe(false)
  })

  it('não entra em laço com cause circular', () => {
    const a: { message: string; cause?: unknown } = { message: 'a' }
    a.cause = a
    expect(ehErroDeConexao(a)).toBe(false)
  })
})

describe('comRetryAntesDeIniciar', () => {
  it('repete uma vez quando a conexão cai antes de o trabalho começar', async () => {
    const executar = vi
      .fn<(sinalizar: () => void) => Promise<string>>()
      .mockRejectedValueOnce(erroConexao())
      .mockResolvedValueOnce('ok')
    await expect(comRetryAntesDeIniciar(executar)).resolves.toBe('ok')
    expect(executar).toHaveBeenCalledTimes(2)
  })

  it('NÃO repete se o trabalho já começou (evita gravação duplicada)', async () => {
    const executar = vi.fn(async (sinalizar: () => void) => {
      sinalizar()
      throw erroConexao()
    })
    await expect(comRetryAntesDeIniciar(executar)).rejects.toThrow('Connection terminated')
    expect(executar).toHaveBeenCalledTimes(1)
  })

  it('não repete erros que não são de conexão', async () => {
    const executar = vi.fn(async () => {
      throw new Error('check constraint violated')
    })
    await expect(comRetryAntesDeIniciar(executar)).rejects.toThrow('check constraint')
    expect(executar).toHaveBeenCalledTimes(1)
  })

  it('desiste depois do limite de tentativas', async () => {
    const executar = vi.fn(async () => {
      throw erroConexao()
    })
    await expect(comRetryAntesDeIniciar(executar, 3)).rejects.toThrow('Connection terminated')
    expect(executar).toHaveBeenCalledTimes(3)
  })

  it('devolve o resultado direto quando não há falha', async () => {
    const executar = vi.fn(async (sinalizar: () => void) => {
      sinalizar()
      return 42
    })
    await expect(comRetryAntesDeIniciar(executar)).resolves.toBe(42)
    expect(executar).toHaveBeenCalledTimes(1)
  })
})
