/**
 * Adiciona um usuário existente como MEMBRO de um workspace de outro usuário (o dono).
 *
 * Uso: npm run adicionar-membro -- [--arquivo <env>]      (padrão: .env.local)
 *
 * FERRAMENTA ADMINISTRATIVA LOCAL, nunca importada pelo app. Usa a conexão do OWNER
 * (DATABASE_URL_UNPOOLED) porque o `app_user` não pode escrever em `workspace_members`
 * (RLS só permite SELECT; é de propósito). Sem terminal, lê 3 linhas do stdin: e-mail do
 * dono, nome do workspace, e-mail de quem entra (em production, antes vem a confirmação).
 */
import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import { adicionarMembro, descreverResultado } from '../src/features/workspaces/adicionar-membro'
import { lerArgs, normalizarEmail, validarNomeWorkspace } from './lib/alvo'
import { carregarAmbiente, confirmarDestino } from './lib/ambiente'
import { criarEntrada } from './lib/terminal'

neonConfig.webSocketConstructor = ws

async function main(): Promise<number> {
  const { arquivo } = lerArgs(process.argv.slice(2), '.env.local')
  const vars = carregarAmbiente(arquivo)
  const urlOwner = vars.DATABASE_URL_UNPOOLED
  if (!urlOwner) {
    console.error(`DATABASE_URL_UNPOOLED (owner) ausente em ${arquivo}.`)
    return 1
  }
  const entrada = await criarEntrada()
  if (!(await confirmarDestino(arquivo, vars, urlOwner, entrada, 'ADICIONAR MEMBRO (conexão do owner)'))) return 1

  const emailDono = normalizarEmail(await entrada.perguntar('E-mail do DONO do workspace: '))
  const nomeBruto = await entrada.perguntar('Nome do workspace: ')
  const emailNovoMembro = normalizarEmail(await entrada.perguntar('E-mail de quem vai entrar: '))
  const nome = validarNomeWorkspace(nomeBruto)
  if (!nome.ok) {
    console.error(nome.erro)
    return 1
  }
  if (!emailDono.includes('@') || !emailNovoMembro.includes('@')) {
    console.error('Informe e-mails válidos.')
    return 1
  }

  const pool = new Pool({ connectionString: urlOwner })
  try {
    const entradaMembro = { emailDono, nomeWorkspace: nome.nome, emailNovoMembro }
    const r = await adicionarMembro(drizzle({ client: pool }), entradaMembro)
    const msg = descreverResultado(r, entradaMembro)
    if (r.ok) console.log(msg)
    else console.error(msg)
    return r.ok ? 0 : 1
  } finally {
    await pool.end()
  }
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error('Falha:', e instanceof Error ? e.message : 'erro')
    process.exit(1)
  })
