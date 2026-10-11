/**
 * Lógica pura dos scripts administrativos (sem I/O): argumentos e decisão sobre o alvo
 * (branch do Neon). Testada em alvo.test.ts.
 */

export type ArgsScript = { arquivo: string; posicionais: string[] }

/** Lê `--arquivo <env>` (ou `--arquivo=<env>`); o resto vira posicionais. Lança se faltar o valor. */
export function lerArgs(argv: string[], arquivoPadrao: string): ArgsScript {
  let arquivo = arquivoPadrao
  const posicionais: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--arquivo') {
      const v = argv[i + 1]
      if (!v || v.startsWith('--')) throw new Error('--arquivo precisa de um caminho (ex.: --arquivo .env.production.local).')
      arquivo = v
      i++
    } else if (a.startsWith('--arquivo=')) {
      const v = a.slice('--arquivo='.length)
      if (!v) throw new Error('--arquivo precisa de um caminho.')
      arquivo = v
    } else if (a.startsWith('--')) {
      throw new Error(`Opção desconhecida: ${a}`)
    } else {
      posicionais.push(a)
    }
  }
  return { arquivo, posicionais }
}

export type AvaliacaoAlvo =
  | { ok: true; branch: string; exigeConfirmacao: boolean }
  | { ok: false; motivo: string }

/**
 * Decide se o alvo é aceitável e se exige confirmação digitada.
 * - NEON_BRANCH ausente: recusa (a segurança depende de saber onde se está).
 * - arquivo com "production" no nome mas branch diferente (ou o inverso): recusa, indica engano.
 * - branch `production`: exige confirmação digitada.
 */
export function avaliarAlvo(branch: string | undefined, arquivo: string): AvaliacaoAlvo {
  const b = branch?.trim()
  if (!b) return { ok: false, motivo: `NEON_BRANCH ausente em ${arquivo}. Recusado por segurança.` }
  const nomeProd = /production/i.test(arquivo)
  const eProd = b === 'production'
  if (nomeProd && !eProd) {
    return { ok: false, motivo: `O arquivo ${arquivo} parece de produção, mas NEON_BRANCH=${b}. Confira o arquivo.` }
  }
  if (!nomeProd && eProd) {
    return { ok: false, motivo: `NEON_BRANCH=production em ${arquivo}, que não tem "production" no nome. Confira o arquivo.` }
  }
  return { ok: true, branch: b, exigeConfirmacao: eProd }
}

/** A confirmação vale se o texto digitado (sem espaços nas pontas) for exatamente o nome da branch. */
export function confirmacaoValida(digitado: string, branch: string): boolean {
  return digitado.trim() === branch
}

/** Apenas o host de uma connection string (nunca usuário/senha); null se não for uma URL. */
export function hostDe(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Nome de workspace: espaços das pontas removidos, 2 a 60 caracteres (mesmo limite do cadastro). */
export function validarNomeWorkspace(bruto: string): { ok: true; nome: string } | { ok: false; erro: string } {
  const nome = bruto.trim()
  if (nome.length < 2) return { ok: false, erro: 'O nome do workspace precisa ter pelo menos 2 caracteres.' }
  if (nome.length > 60) return { ok: false, erro: 'O nome do workspace pode ter no máximo 60 caracteres.' }
  return { ok: true, nome }
}

export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase()
}
