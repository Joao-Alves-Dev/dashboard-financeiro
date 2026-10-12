import { describe, expect, it } from 'vitest'
import { paraPdf, renderizarPdf } from './render-pdf'
import type { Relatorio } from './relatorio'

const relatorio = (n: number, total?: string): Relatorio => ({
  titulo: 'Transações efetuadas | Jerônimo',
  periodo: '12/03/2026 a 26/03/2026',
  linhas: Array.from({ length: n }, (_, i) => ({
    data: `${String((i % 28) + 1).padStart(2, '0')}/09/2026`,
    anotacao: i === 0 ? 'Viagem à Conceição – ação' : 'Combustível',
    valor: 'R$ 300,00',
  })),
  ...(total ? { total } : {}),
})

async function bytesLatin1(r: Relatorio): Promise<string> {
  const blob = await renderizarPdf(r)
  return Buffer.from(await blob.arrayBuffer()).toString('latin1')
}

describe('renderizarPdf', () => {
  it('é um PDF A4 com Helvetica em WinAnsi e acentos preservados (sem transliterar)', async () => {
    const s = await bytesLatin1(relatorio(3))
    expect(s.startsWith('%PDF-')).toBe(true)
    expect(s).toContain('/WinAnsiEncoding')
    expect(s).toMatch(/MediaBox \[0 0 595\.2\d+ 841\.8\d+\]/)
    expect(s).toContain('Transações efetuadas | Jerônimo')
    expect(s).toContain('Anotações')
    expect(s).toContain('Viagem à Conceição')
    expect(s).not.toContain('Transacoes')
    expect(s).not.toContain('Jeronimo')
  })

  it('pagina automaticamente e põe o total só no fim', async () => {
    const s = await bytesLatin1(relatorio(60, 'R$ 18.000,00'))
    const paginas = (s.match(/\/Type \/Page\b(?!s)/g) ?? []).length
    expect(paginas).toBeGreaterThan(1)
    expect(s).toContain('Página 1/')
    expect(s.match(/Total/g)?.length).toBe(1)
  })

  it('sem total não escreve "Total"', async () => {
    expect(await bytesLatin1(relatorio(3))).not.toContain('(Total)')
  })
})

describe('paraPdf', () => {
  it('mantém o português e troca só o que a fonte padrão não tem', () => {
    expect(paraPdf('Jerônimo – Conceição “ok” º')).toBe('Jerônimo – Conceição “ok” º')
    expect(paraPdf('pago 😀 ok')).toBe('pago ? ok')
    expect(paraPdf('José')).toBe('José') // acento combinado vira o caractere composto
  })
})
