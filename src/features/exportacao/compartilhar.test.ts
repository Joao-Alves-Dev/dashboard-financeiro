import { afterEach, describe, expect, it, vi } from 'vitest'
import { compartilharOuBaixar, nomeArquivoExportacao, slugArquivo } from './compartilhar'

describe('nomes de arquivo', () => {
  it('slug sem acento, minúsculo, só [a-z0-9-]', () => {
    expect(slugArquivo('Jerônimo')).toBe('jeronimo')
    expect(slugArquivo('  Maria José da Silva! ')).toBe('maria-jose-da-silva')
    expect(slugArquivo('')).toBe('todos')
    expect(slugArquivo('///')).toBe('todos')
    expect(slugArquivo('Ação/../etc')).toBe('acao-etc')
  })

  it('nome do arquivo com período e extensão', () => {
    expect(nomeArquivoExportacao('Jerônimo', '2026-03-12', '2026-03-26', 'png')).toBe(
      'transacoes-jeronimo-2026-03-12-a-2026-03-26.png',
    )
    expect(nomeArquivoExportacao('Todos', '2026-09-01', '2026-09-30', 'pdf')).toBe(
      'transacoes-todos-2026-09-01-a-2026-09-30.pdf',
    )
  })

  it('várias partes ganham sufixo; uma só não', () => {
    expect(nomeArquivoExportacao('Jerônimo', '2026-03-12', '2026-03-26', 'png', { numero: 2, total: 3 })).toBe(
      'transacoes-jeronimo-2026-03-12-a-2026-03-26-parte-2-de-3.png',
    )
    expect(nomeArquivoExportacao('Jerônimo', '2026-03-12', '2026-03-26', 'png', { numero: 1, total: 1 })).toBe(
      'transacoes-jeronimo-2026-03-12-a-2026-03-26.png',
    )
  })
})

describe('compartilharOuBaixar', () => {
  afterEach(() => vi.unstubAllGlobals())

  const arquivo = { name: 'a.png' } as File
  const download = () => {
    const clique = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => ({ click: clique, remove: vi.fn(), set href(_: string) {}, set download(_: string) {}, set rel(_: string) {} }),
      body: { appendChild: vi.fn() },
    })
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() })
    return clique
  }

  it('usa o compartilhamento do sistema quando pode enviar arquivos', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await compartilharOuBaixar([arquivo], 'Lista')).toBe('compartilhado')
    expect(share).toHaveBeenCalledWith({ files: [arquivo], title: 'Lista' })
  })

  it('cancelar o menu (AbortError) não é erro nem baixa nada', async () => {
    const clique = download()
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await compartilharOuBaixar([arquivo], 'Lista')).toBe('cancelado')
    await new Promise((r) => setTimeout(r, 10))
    expect(clique).not.toHaveBeenCalled()
  })

  it('sem suporte a arquivos, baixa', async () => {
    const clique = download()
    vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => false })
    expect(await compartilharOuBaixar([arquivo], 'Lista')).toBe('baixado')
    await new Promise((r) => setTimeout(r, 10))
    expect(clique).toHaveBeenCalledTimes(1)
  })

  it('sem Web Share (desktop), baixa', async () => {
    const clique = download()
    vi.stubGlobal('navigator', {})
    expect(await compartilharOuBaixar([arquivo], 'Lista')).toBe('baixado')
    await new Promise((r) => setTimeout(r, 10))
    expect(clique).toHaveBeenCalledTimes(1)
  })

  it('falha do compartilhamento que não é cancelamento cai no download', async () => {
    const clique = download()
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
    vi.stubGlobal('navigator', { share, canShare: () => true })
    expect(await compartilharOuBaixar([arquivo], 'Lista')).toBe('baixado')
    await new Promise((r) => setTimeout(r, 10))
    expect(clique).toHaveBeenCalledTimes(1)
  })
})
