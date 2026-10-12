/**
 * Cria (ou rotaciona a senha de) a role `app_user`, usada pela aplicação, sem BYPASSRLS.
 * O dono das tabelas (neondb_owner) tem BYPASSRLS no Neon e fica restrito às migrações.
 *
 * Uso: npx tsx scripts/criar-role-app.ts [--arquivo <caminho do env>]   (padrão: .env.local)
 * - ANTES de conectar, mostra o quadro de destino (arquivo, HOST do banco, branch; nunca senha) e,
 *   em `production`, exige digitar o nome da branch (sem terminal: a primeira linha do stdin);
 *   recusa arquivo e branch que não combinam (ver scripts/lib/alvo.ts);
 * - conecta com DATABASE_URL_UNPOOLED (owner);
 * - reescreve SOMENTE DATABASE_URL no arquivo (app_user + host pooled), preservando o resto;
 * - nunca imprime senha nem URLs.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import { lerArgs } from './lib/alvo'
import { confirmarDestino } from './lib/ambiente'
import { criarEntrada } from './lib/terminal'

neonConfig.webSocketConstructor = ws

async function main(): Promise<number> {
  const { arquivo: informado } = lerArgs(process.argv.slice(2), '.env.local')
  const arquivo = resolve(informado)

  const bruto = readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
  const vars = parse(bruto)
  const urlOwner = vars.DATABASE_URL_UNPOOLED
  if (!urlOwner) throw new Error(`DATABASE_URL_UNPOOLED ausente em ${informado}`)

  // Confirmação de destino ANTES de qualquer conexão: este script troca a senha do app_user.
  const entrada = await criarEntrada()
  if (!(await confirmarDestino(informado, vars, urlOwner, entrada, 'CRIAR / ROTACIONAR A ROLE app_user'))) return 1

  const senha = randomBytes(32).toString('base64url')
  const pool = new Pool({ connectionString: urlOwner })
  try {
    const existe = await pool.query("select 1 from pg_roles where rolname = 'app_user'")
    // senha gerada localmente em base64url (sem aspas); DDL não aceita parâmetros.
    if (existe.rowCount === 0) {
      await pool.query(
        `create role app_user login password '${senha}' nobypassrls nocreaterole nocreatedb noinherit`,
      )
      console.log('Role app_user criada.')
    } else {
      await pool.query(`alter role app_user with login password '${senha}' nobypassrls`)
      console.log('Senha da role app_user rotacionada.')
    }
    const chk = await pool.query(
      `select rolbypassrls, rolsuper, pg_has_role('app_user', 'neon_superuser', 'member') as neon_su
         from pg_roles where rolname = 'app_user'`,
    )
    const r = chk.rows[0]
    if (!r || r.rolbypassrls !== false || r.rolsuper !== false || r.neon_su !== false) {
      throw new Error('app_user não está restrita (bypassrls/superuser/neon_superuser). Abortado.')
    }
    console.log('Verificado: app_user sem BYPASSRLS, sem superuser, fora de neon_superuser.')
  } finally {
    await pool.end()
  }

  const u = new URL(urlOwner)
  u.username = 'app_user'
  u.password = senha
  const [primeiro, ...resto] = u.hostname.split('.')
  if (!primeiro.endsWith('-pooler')) u.hostname = [`${primeiro}-pooler`, ...resto].join('.')
  const novaUrl = u.toString()

  const linhas = bruto.split(/\r?\n/)
  let achou = false
  const saida = linhas.map((l) => {
    if (/^\s*DATABASE_URL\s*=/.test(l)) {
      achou = true
      return `DATABASE_URL=${novaUrl}`
    }
    return l
  })
  if (!achou) saida.push(`DATABASE_URL=${novaUrl}`)
  writeFileSync(arquivo, saida.join('\n'), { encoding: 'utf8' })
  console.log('DATABASE_URL atualizada no arquivo para app_user (pooled).')
  return 0
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('Falha:', e instanceof Error ? e.message.replace(/password '[^']*'/g, "password '***'") : 'erro')
  process.exit(1)
})
