/**
 * Copia o valor de UMA variável de um arquivo de env para a área de transferência (Windows `clip`),
 * sem imprimir o valor. Serve para colar segredos no painel da Vercel sem exibi-los.
 *
 * Uso: npm run env:copiar -- <CHAVE> [--arquivo <env>]      (padrão: .env.local)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { lerArgs } from './lib/alvo'

function main(): number {
  const { arquivo, posicionais } = lerArgs(process.argv.slice(2), '.env.local')
  const chave = posicionais[0]
  if (!chave || posicionais.length > 1) {
    console.error('Uso: npm run env:copiar -- <CHAVE> [--arquivo <env>]')
    return 1
  }
  if (process.platform !== 'win32') {
    console.error('Este script usa o comando "clip" do Windows.')
    return 1
  }
  let bruto: string
  try {
    bruto = readFileSync(resolve(arquivo), 'utf8')
  } catch {
    console.error(`Não consegui ler o arquivo: ${arquivo}`)
    return 1
  }
  const valor = parse(bruto.replace(new RegExp('^' + String.fromCharCode(0xfeff)), ''))[chave]
  if (!valor) {
    console.error(`A chave ${chave} não existe (ou está vazia) em ${arquivo}.`)
    return 1
  }
  const r = spawnSync('clip', { input: valor, windowsHide: true })
  if (r.status !== 0) {
    console.error('Falha ao copiar para a área de transferência.')
    return 1
  }
  console.log(`Copiado ${chave} de ${arquivo} (${valor.length} caracteres). Cole com Ctrl+V; o valor não foi exibido.`)
  return 0
}

process.exit(main())
