import { randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { user } from '@/db/auth-schema'
import { criarAuth, criarAuthInterno } from '@/lib/auth'

// Teste de fumaça do script `criar-usuario` (processo real, stdin NÃO-TTY) contra a branch dev.
const exec = randomUUID().slice(0, 8)
const email = `script-${exec}@teste.invalid`
const senha = randomBytes(12).toString('hex')
const pasta = mkdtempSync(join(tmpdir(), 'criar-usuario-'))

function rodar(args: string[], stdin: string) {
  return spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/criar-usuario.ts', ...args], {
    input: stdin,
    encoding: 'utf8',
    env: process.env,
    timeout: 100_000,
  })
}

afterAll(async () => {
  await db.delete(user).where(inArray(user.email, [email]))
  rmSync(pasta, { recursive: true, force: true })
})

describe('script criar-usuario (não-TTY)', () => {
  it('cria o usuário, não imprime a senha, e o login funciona', async () => {
    const r = rodar([], `Teste Script\n${email}\n${senha}\n`)
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('Usuário criado')
    expect(r.stdout + r.stderr).not.toContain(senha)

    const [u] = await db.select().from(user).where(eq(user.email, email))
    expect(u?.name).toBe('Teste Script')

    const ok = await criarAuthInterno().api.signInEmail({ body: { email, password: senha } })
    expect(ok.user.id).toBe(u.id)
    await expect(
      criarAuthInterno().api.signInEmail({ body: { email, password: senha + 'x' } }),
    ).rejects.toThrow()
  })

  it('e-mail repetido: mensagem clara e falha', () => {
    const r = rodar([], `Outro Nome\n${email.toUpperCase()}\n${senha}\n`)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Já existe um usuário com este e-mail.')
  })

  it('senha curta: mensagem clara, falha e nada é criado', async () => {
    const outro = `curta-${exec}@teste.invalid`
    const r = rodar([], `Teste\n${outro}\n1234567\n`)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('pelo menos 8 caracteres')
    expect(await db.select({ id: user.id }).from(user).where(eq(user.email, outro))).toHaveLength(0)
  })

  it('branch production exige confirmação digitada; errada não toca no banco', () => {
    const arq = join(pasta, 'x-production.env')
    writeFileSync(arq, 'NEON_BRANCH=production\nDATABASE_URL=postgresql://u:s@host-falso.invalid/db\n')
    const r = rodar(['--arquivo', arq], `errado\nNome\nprod-${exec}@teste.invalid\n${senha}\n`)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('PRODUÇÃO')
    expect(r.stderr).toContain('Confirmação não confere')
  })

  it('a instância pública da edição pessoal continua recusando cadastro', async () => {
    const resp = await criarAuth('pessoal').handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ name: 'X', email: `http-${exec}@teste.invalid`, password: senha }),
      }),
    )
    expect(resp.status).toBe(400)
    expect(((await resp.json()) as { code?: string }).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
  })
})
