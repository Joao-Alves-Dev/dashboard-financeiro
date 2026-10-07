import 'server-only'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'
import * as authSchema from './auth-schema'

// Em Node não existe WebSocket global; o driver do Neon precisa do construtor.
neonConfig.webSocketConstructor = ws

// Conexão pooled (DATABASE_URL). Migrações usam DATABASE_URL_UNPOOLED (drizzle.config.ts).
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const db = drizzle({ client: pool, schema: { ...schema, ...authSchema } })
