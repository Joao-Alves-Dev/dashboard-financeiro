import 'server-only'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'
import * as authSchema from './auth-schema'

// Em Node não existe WebSocket global; o driver do Neon precisa do construtor.
neonConfig.webSocketConstructor = ws

// Conexão pooled (DATABASE_URL). Migrações usam DATABASE_URL_UNPOOLED (drizzle.config.ts).
// O PgBouncer do Neon derruba conexões ociosas depois de poucos segundos; manter o tempo ocioso
// do pool curto evita reaproveitar uma conexão que o servidor já fechou.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 4000,
})

// Sem este listener, um erro numa conexão ociosa derruba o processo (evento 'error' sem tratador).
pool.on('error', (erro: Error) => {
  console.error('[db] conexão ociosa encerrada pelo servidor:', erro.message)
})

export const db = drizzle({ client: pool, schema: { ...schema, ...authSchema } })
