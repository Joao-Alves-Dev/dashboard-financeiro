import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '../db/cliente'
import * as authSchema from '../db/auth-schema'

// Para regenerar o esquema: remover temporariamente o import 'server-only' deste arquivo
// e de src/db/cliente.ts e rodar `npx auth@latest generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`.
// Segredo e URL base vêm de BETTER_AUTH_SECRET e BETTER_AUTH_URL.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  emailAndPassword: { enabled: true },
  // nextCookies deve ser o último plugin.
  plugins: [nextCookies()],
})
