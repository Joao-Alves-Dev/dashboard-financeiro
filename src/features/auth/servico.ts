import 'server-only'
import type { auth as authPadrao } from '@/lib/auth'
import { recursos, type Edicao } from '@/lib/edicao'

export type DadosCadastro = { nome: string; email: string; senha: string }
export type ResultadoCadastro =
  | { ok: true }
  | { ok: false; motivo: 'cadastro_fechado' | 'email_existe' | 'erro' }

/**
 * Cadastro público por e-mail. Recusa na edição com cadastro fechado ANTES de tocar no
 * Better Auth (defesa em profundidade: a instância `auth` também tem disableSignUp).
 */
export async function cadastrarUsuario(
  dados: DadosCadastro,
  contexto: { edicao: Edicao; auth: Pick<typeof authPadrao, 'api'>; headers?: Headers },
): Promise<ResultadoCadastro> {
  if (!recursos(contexto.edicao).cadastroAberto) return { ok: false, motivo: 'cadastro_fechado' }
  try {
    await contexto.auth.api.signUpEmail({
      body: { name: dados.nome, email: dados.email, password: dados.senha },
      headers: contexto.headers,
    })
  } catch (e) {
    const codigo = (e as { body?: { code?: string } }).body?.code ?? ''
    if (codigo.startsWith('USER_ALREADY_EXISTS')) return { ok: false, motivo: 'email_existe' }
    return { ok: false, motivo: 'erro' }
  }
  return { ok: true }
}
