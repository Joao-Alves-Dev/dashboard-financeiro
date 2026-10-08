import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '../db/cliente'
import * as authSchema from '../db/auth-schema'
import { obterEdicao, recursos, type Edicao } from './edicao'

// Para regenerar o esquema: remover temporariamente o import 'server-only' deste arquivo
// e de src/db/cliente.ts e rodar `npx auth@latest generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`.
// Segredo e URL base vêm de BETTER_AUTH_SECRET e BETTER_AUTH_URL.

type OpcoesAuth = {
  /**
   * Ignora o fechamento de cadastro da edição. SÓ para instâncias de uso interno em
   * scripts de servidor (ex.: `criar-usuario`, Task 17), que nunca são expostas por HTTP.
   */
  cadastroInterno?: boolean
}

/**
 * `emailAndPassword.disableSignUp` do Better Auth vale tanto para o endpoint HTTP
 * (/api/auth/sign-up/email) quanto para `auth.api.signUpEmail` (é a mesma rota; não há
 * como distinguir o chamador). Por isso o bloqueio é por instância: o export `auth`
 * (usado pelo handler HTTP e pela Server Action) segue a edição; scripts internos usam
 * `criarAuthInterno()`, instância separada com cadastro permitido e sem handler HTTP.
 */
export function criarAuth(edicao: Edicao, opcoes: OpcoesAuth = {}) {
  const cadastroAberto = opcoes.cadastroInterno || recursos(edicao).cadastroAberto
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: { enabled: true, disableSignUp: !cadastroAberto },
    // Task 18: incluir anonymous() aqui quando recursos(edicao).demo, antes de nextCookies.
    // nextCookies deve ser o último plugin.
    plugins: [nextCookies()],
  })
}

export const auth = criarAuth(obterEdicao())

/** Instância para scripts de servidor que criam usuários mesmo com o cadastro fechado. */
export function criarAuthInterno() {
  return criarAuth(obterEdicao(), { cadastroInterno: true })
}
