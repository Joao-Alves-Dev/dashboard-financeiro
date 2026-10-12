import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

// Script `criar-role-app` (processo real, stdin NÃO-TTY) com arquivos de env FALSOS em diretório
// temporário: host `.invalid`, nunca a branch dev real. A confirmação de destino precisa acontecer
// ANTES de qualquer conexão (o script troca a senha do app_user).
const pasta = mkdtempSync(join(tmpdir(), 'criar-role-app-'))
const SENHA_FALSA = 'senha-falsa-nao-imprimir'
const URL_FALSA = `postgresql://dono:${SENHA_FALSA}@host-falso.invalid/neondb?sslmode=require`

// Sem as variáveis de banco do shell: o script só pode usar o arquivo informado.
const envSemBanco = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('DATABASE_URL') && k !== 'ENV_FILE' && k !== 'NEON_BRANCH'),
) as NodeJS.ProcessEnv

function rodar(args: string[], stdin: string) {
  return spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/criar-role-app.ts', ...args], {
    input: stdin,
    encoding: 'utf8',
    env: envSemBanco,
    timeout: 100_000,
  })
}

function arquivoEnv(nome: string, branch: string) {
  const arq = join(pasta, nome)
  writeFileSync(arq, `NEON_BRANCH=${branch}\nDATABASE_URL_UNPOOLED=${URL_FALSA}\nDATABASE_URL=original\n`)
  return arq
}

afterAll(() => {
  rmSync(pasta, { recursive: true, force: true })
})

describe('script criar-role-app: confirmação de destino', () => {
  it('branch production com confirmação errada: mostra o quadro (host, nunca senha) e aborta sem conectar', () => {
    const arq = arquivoEnv('x.env.production.local', 'production')
    const r = rodar(['--arquivo', arq], 'errado\n')
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('CRIAR / ROTACIONAR A ROLE app_user')
    expect(r.stdout).toContain('host-falso.invalid')
    expect(r.stdout).toContain('PRODUÇÃO')
    expect(r.stdout).toContain('Digite "production" para confirmar')
    expect(r.stderr).toContain('Confirmação não confere. Nada foi feito.')
    // Nenhuma tentativa de conexão (seria "Falha: ..." com host .invalid) nem escrita no arquivo.
    expect(r.stderr).not.toContain('Falha')
    expect(r.stdout).not.toMatch(/app_user (criada|rotacionada)|DATABASE_URL atualizada/i)
    expect(r.stdout + r.stderr).not.toContain(SENHA_FALSA)
    expect(readFileSync(arq, 'utf8')).toContain('DATABASE_URL=original')
  })

  it('sem resposta no stdin também aborta sem conectar', () => {
    const arq = arquivoEnv('y.env.production.local', 'production')
    const r = rodar(['--arquivo', arq], '')
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('PRODUÇÃO')
    expect(r.stdout + r.stderr).not.toMatch(/app_user (criada|rotacionada)|DATABASE_URL atualizada/i)
    expect(r.stdout + r.stderr).not.toContain(SENHA_FALSA)
    expect(readFileSync(arq, 'utf8')).toContain('DATABASE_URL=original')
  })

  it('NEON_BRANCH=production num arquivo sem "production" no nome: recusa sem perguntar nem conectar', () => {
    const arq = arquivoEnv('z.env.local', 'production')
    const r = rodar(['--arquivo', arq], 'production\n')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Recusado')
    expect(r.stdout).not.toContain('Digite')
    expect(r.stderr).not.toContain('Falha')
    expect(readFileSync(arq, 'utf8')).toContain('DATABASE_URL=original')
  })

  it('arquivo de produção com outra branch: recusa', () => {
    const arq = arquivoEnv('w.env.production.local', 'dev')
    const r = rodar(['--arquivo', arq], 'production\n')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Recusado')
    expect(r.stderr).not.toContain('Falha')
  })

  it('NEON_BRANCH ausente: recusa', () => {
    const arq = join(pasta, 'sem-branch.env')
    writeFileSync(arq, `DATABASE_URL_UNPOOLED=${URL_FALSA}\n`)
    const r = rodar(['--arquivo', arq], 'production\n')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('NEON_BRANCH ausente')
    expect(r.stderr).not.toContain('Falha')
  })

  it('confirmação certa segue para a conexão (que falha no host .invalid) sem imprimir a senha', () => {
    const arq = arquivoEnv('v.env.production.local', 'production')
    const r = rodar(['--arquivo', arq], 'production\n')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Falha')
    expect(r.stdout + r.stderr).not.toContain(SENHA_FALSA)
    expect(readFileSync(arq, 'utf8')).toContain('DATABASE_URL=original')
  })
})
