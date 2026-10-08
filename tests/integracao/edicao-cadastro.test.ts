import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '@/db/cliente'
import { user } from '@/db/auth-schema'
import { criarAuth, criarAuthInterno } from '@/lib/auth'
import { cadastrarUsuario } from '@/features/auth/servico'

// E-mails e senhas de teste gerados aqui; a limpeza no afterAll roda mesmo se um teste falhar.
const exec = randomUUID().slice(0, 8)
const email = (rotulo: string) => `edicao-${exec}-${rotulo}@teste.invalid`
const emails: string[] = []
const novoEmail = (rotulo: string) => {
  const e = email(rotulo)
  emails.push(e)
  return e
}
const senha = () => randomBytes(12).toString('hex')

async function existe(e: string): Promise<boolean> {
  const r = await db.select({ id: user.id }).from(user).where(inArray(user.email, [e]))
  return r.length > 0
}

function postSignUp(auth: ReturnType<typeof criarAuth>, e: string) {
  return auth.handler(
    new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Teste Edicao', email: e, password: senha() }),
    }),
  )
}

afterAll(async () => {
  if (emails.length) await db.delete(user).where(inArray(user.email, emails))
})

describe('edição pessoal: cadastro fechado', () => {
  const authPessoal = criarAuth('pessoal')

  it('serviço de cadastro recusa e não cria usuário', async () => {
    const e = novoEmail('servico-pessoal')
    const r = await cadastrarUsuario(
      { nome: 'Teste', email: e, senha: senha() },
      { edicao: 'pessoal', auth: authPessoal },
    )
    expect(r).toEqual({ ok: false, motivo: 'cadastro_fechado' })
    expect(await existe(e)).toBe(false)
  })

  it('mesmo se o serviço fosse contornado, a instância pessoal recusa (disableSignUp)', async () => {
    const e = novoEmail('instancia-pessoal')
    const r = await cadastrarUsuario(
      { nome: 'Teste', email: e, senha: senha() },
      { edicao: 'portfolio', auth: authPessoal }, // serviço liberado, instância fechada
    )
    expect(r).toEqual({ ok: false, motivo: 'erro' })
    expect(await existe(e)).toBe(false)
  })

  it('endpoint HTTP /api/auth/sign-up/email recusa e não cria usuário', async () => {
    const e = novoEmail('http-pessoal')
    const resp = await postSignUp(authPessoal, e)
    expect(resp.status).toBe(400)
    expect(((await resp.json()) as { code?: string }).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
    expect(await existe(e)).toBe(false)
  })
})

describe('edição portfolio: cadastro aberto', () => {
  const authPortfolio = criarAuth('portfolio')

  it('serviço de cadastro cria o usuário', async () => {
    const e = novoEmail('servico-portfolio')
    const r = await cadastrarUsuario(
      { nome: 'Teste', email: e, senha: senha() },
      { edicao: 'portfolio', auth: authPortfolio },
    )
    expect(r).toEqual({ ok: true })
    expect(await existe(e)).toBe(true)
  })

  it('endpoint HTTP cria o usuário', async () => {
    const e = novoEmail('http-portfolio')
    const resp = await postSignUp(authPortfolio, e)
    expect(resp.status).toBe(200)
    expect(await existe(e)).toBe(true)
  })
})

describe('caminho interno (script criar-usuario)', () => {
  it('instância interna cria usuário mesmo com edição pessoal', async () => {
    const e = novoEmail('interno-pessoal')
    const r = await criarAuth('pessoal', { cadastroInterno: true }).api.signUpEmail({
      body: { name: 'Teste Interno', email: e, password: senha() },
    })
    expect(r.user.email).toBe(e)
    expect(await existe(e)).toBe(true)
  })

  it('criarAuthInterno() (edição do ambiente) cria usuário', async () => {
    const e = novoEmail('interno-ambiente')
    await criarAuthInterno().api.signUpEmail({
      body: { name: 'Teste Interno', email: e, password: senha() },
    })
    expect(await existe(e)).toBe(true)
  })
})
