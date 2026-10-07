import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// Integração roda local contra a branch dev do Neon; o CI não executa esses testes (sem segredos).
config({ path: '.env.local', quiet: true })

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` lança erro fora do bundler do Next; nos testes vira no-op.
      'server-only': fileURLToPath(new URL('./tests/integracao/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integracao/**/*.test.ts'],
    passWithNoTests: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
