import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/cliente'
import * as authSchema from '../db/auth-schema'

// Mínimo para a Task 3 (geração do esquema). Completado na Task 7.
// Para regenerar o esquema: remover temporariamente o import 'server-only' deste arquivo
// e de src/db/cliente.ts e rodar `npx auth@latest generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
  emailAndPassword: { enabled: true },
})
