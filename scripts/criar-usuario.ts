/**
 * Cria um usuário (nome, e-mail, senha) na branch indicada pelo arquivo de env.
 * Ferramenta administrativa local; é o único caminho de cadastro na edição "pessoal".
 *
 * Uso: npm run criar-usuario -- [--arquivo <env>]      (padrão: .env.local)
 * - Com terminal: pede nome, e-mail e senha (sem eco, com confirmação, mínimo 8 caracteres).
 * - Sem terminal (stdin redirecionado): lê 3 linhas do stdin, na ordem nome, e-mail, senha
 *   (para branch production, antes delas vem a linha de confirmação com o nome da branch).
 *   A senha nunca é aceita por argumento de linha de comando e nunca é impressa.
 * - Mostra HOST e branch antes de agir; em `production` exige digitar o nome da branch.
 *
 * O env é carregado ANTES de importar qualquer módulo do app (que lê process.env.DATABASE_URL).
 */
import messages from '../messages/pt-BR.json'
import { cadastroSchema } from '../src/features/auth/schemas'
import { lerArgs, normalizarEmail } from './lib/alvo'
import { carregarAmbiente, confirmarDestino, liberarServerOnly } from './lib/ambiente'
import { criarEntrada } from './lib/terminal'

function traduzir(chave: string): string {
  let no: unknown = messages
  for (const parte of chave.split('.')) no = (no as Record<string, unknown> | undefined)?.[parte]
  return typeof no === 'string' ? no : chave
}

function erroDoCampo(r: { success: boolean; error?: { issues: { message: string }[] } }): string | null {
  return r.success ? null : traduzir(r.error!.issues[0].message)
}

async function main() {
  const { arquivo } = lerArgs(process.argv.slice(2), '.env.local')
  const vars = carregarAmbiente(arquivo)
  liberarServerOnly()
  const entrada = await criarEntrada()

  const host = vars.DATABASE_URL || vars.DATABASE_URL_UNPOOLED
  if (!(await confirmarDestino(arquivo, vars, host, entrada, 'CRIAR USUÁRIO'))) return 1

  // Só agora os módulos do app (leem DATABASE_URL ao serem importados).
  const { eq } = await import('drizzle-orm')
  const { db } = await import('../src/db/cliente')
  const { user } = await import('../src/db/auth-schema')
  const { criarAuthInterno } = await import('../src/lib/auth')

  // Em terminal, repete a pergunta até valer; sem terminal, a primeira resposta inválida aborta.
  async function campo(texto: string, validar: (v: string) => Promise<string | null>, senha = false): Promise<string | null> {
    for (;;) {
      const v = await (senha ? entrada.perguntarSenha(texto) : entrada.perguntar(texto))
      const erro = await validar(v)
      if (!erro) return v
      console.error(erro)
      if (!entrada.tty) return null
    }
  }

  const nome = await campo('Nome: ', async (v) => erroDoCampo(cadastroSchema.shape.nome.safeParse(v)))
  if (nome === null) return 1
  const emailBruto = await campo('E-mail: ', async (v) => {
    const e = erroDoCampo(cadastroSchema.shape.email.safeParse(v))
    if (e) return e
    const ja = await db.select({ id: user.id }).from(user).where(eq(user.email, normalizarEmail(v))).limit(1)
    return ja.length ? 'Já existe um usuário com este e-mail.' : null
  })
  if (emailBruto === null) return 1
  const senha = await campo(
    'Senha (mín. 8 caracteres, não aparece na tela): ',
    async (v) => erroDoCampo(cadastroSchema.shape.senha.safeParse(v)),
    true,
  )
  if (senha === null) return 1
  if (entrada.tty) {
    const outra = await entrada.perguntarSenha('Repita a senha: ')
    if (outra !== senha) {
      console.error('As senhas não conferem. Nada foi criado.')
      return 1
    }
  }

  const email = normalizarEmail(emailBruto)
  try {
    const r = await criarAuthInterno().api.signUpEmail({ body: { name: nome.trim(), email, password: senha } })
    console.log(`Usuário criado: ${r.user.email} (id ${r.user.id}).`)
    return 0
  } catch (e) {
    const code = (e as { body?: { code?: string } })?.body?.code
    if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      console.error('Já existe um usuário com este e-mail.')
    } else if (code === 'PASSWORD_TOO_SHORT') {
      console.error(traduzir('validacao.senhaCurta'))
    } else {
      console.error(`Não foi possível criar o usuário${code ? ` (${code})` : ''}.`)
    }
    return 1
  } finally {
    await db.$client.end()
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e) => {
    console.error('Falha:', e instanceof Error ? e.message : 'erro')
    process.exit(1)
  })
