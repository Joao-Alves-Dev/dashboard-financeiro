/**
 * Aplica as migrações (drizzle-kit migrate) no banco indicado por um arquivo de env.
 *
 * Uso: tsx scripts/migrar.ts --arquivo <env>      (npm run db:migrate:prod usa .env.production.local)
 * - mostra HOST do banco (nunca senha) e a branch (NEON_BRANCH);
 * - em `production`, exige digitar o nome da branch para confirmar;
 * - roda o drizzle-kit com ENV_FILE apontando para o mesmo arquivo (ver drizzle.config.ts).
 *
 * Ordem na primeira publicação: criar o env -> `db:criar-role-app` (a migração de grants exige
 * a role app_user) -> este script.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { lerArgs } from './lib/alvo'
import { carregarAmbiente, confirmarDestino } from './lib/ambiente'
import { criarEntrada } from './lib/terminal'

async function main(): Promise<number> {
  const { arquivo } = lerArgs(process.argv.slice(2), '.env.local')
  const vars = carregarAmbiente(arquivo)
  if (!vars.DATABASE_URL_UNPOOLED) {
    console.error(`DATABASE_URL_UNPOOLED (owner) ausente em ${arquivo}.`)
    return 1
  }
  const entrada = await criarEntrada()
  if (!(await confirmarDestino(arquivo, vars, vars.DATABASE_URL_UNPOOLED, entrada, 'APLICAR MIGRAÇÕES'))) return 1

  // Executa o JS do drizzle-kit com o próprio node: funciona igual no Windows (sem .cmd/shell).
  const bin = join(process.cwd(), 'node_modules', 'drizzle-kit', 'bin.cjs')
  if (!existsSync(bin)) {
    console.error('drizzle-kit não encontrado. Rode "npm ci" primeiro.')
    return 1
  }
  const r = spawnSync(process.execPath, [bin, 'migrate'], {
    stdio: 'inherit',
    env: { ...process.env, ENV_FILE: resolve(arquivo) },
  })
  return r.status ?? 1
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error('Falha:', e instanceof Error ? e.message : 'erro')
    process.exit(1)
  })
