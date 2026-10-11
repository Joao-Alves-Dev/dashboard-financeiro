import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Arquivo de env escolhido por ENV_FILE (scripts/migrar.ts); padrão .env.local.
// override: o arquivo escolhido vence variáveis que já estejam no shell (evita migrar o banco errado).
config({ path: process.env.ENV_FILE ?? '.env.local', override: true })

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/*schema.ts',
  out: './db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! },
})
