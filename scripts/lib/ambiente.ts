/**
 * Preparação de ambiente dos scripts administrativos (rodam com `tsx`, fora do Next).
 * Nada aqui imprime valores de variáveis.
 */
import Module from 'node:module'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'dotenv'
import { avaliarAlvo, confirmacaoValida, hostDe } from './alvo'
import type { Entrada } from './terminal'

/**
 * Carrega o arquivo de env em process.env (o arquivo vence o que já estiver no shell).
 * Deve ser chamado ANTES de importar (import dinâmico) qualquer módulo que leia process.env.
 */
export function carregarAmbiente(arquivo: string): Record<string, string> {
  const caminho = resolve(arquivo)
  let bruto: string
  try {
    bruto = readFileSync(caminho, 'utf8')
  } catch {
    throw new Error(`Não consegui ler o arquivo de ambiente: ${arquivo}`)
  }
  const vars = parse(bruto.replace(new RegExp("^" + String.fromCharCode(0xfeff)), ""))
  for (const [k, v] of Object.entries(vars)) process.env[k] = v
  return vars
}

/**
 * Resolve `import 'server-only'` fora do Next. O pacote só deixa de lançar erro sob a
 * condição `react-server`; aqui o pedido de resolução de 'server-only' é redirecionado para
 * um módulo vazio, sem alterar a resolução de nenhum outro pacote (a condição
 * `react-server` global trocaria também o build do React). Vale para o processo todo.
 */
export function liberarServerOnly(): void {
  const M = Module as unknown as {
    _resolveFilename: (request: string, ...resto: unknown[]) => string
  }
  const original = M._resolveFilename
  const vazio = join(__dirname, 'server-only-vazio.ts')
  M._resolveFilename = function (request: string, ...resto: unknown[]) {
    if (request === 'server-only') return vazio
    return original.call(this, request, ...resto)
  }
}

/**
 * Mostra o quadro de destino (HOST e branch, nunca senha) e, para `production`, exige que o
 * nome da branch seja digitado. Devolve false (e já explicou o motivo) se não deve prosseguir.
 */
export async function confirmarDestino(
  arquivo: string,
  vars: Record<string, string>,
  hostDeReferencia: string | undefined,
  entrada: Entrada,
  titulo: string,
): Promise<boolean> {
  const aval = avaliarAlvo(vars.NEON_BRANCH, arquivo)
  if (!aval.ok) {
    console.error(`Recusado: ${aval.motivo}`)
    return false
  }
  const host = hostDe(hostDeReferencia) ?? '(host não identificado)'
  console.log('')
  console.log('+----------------------------------------------------------+')
  console.log(`| ${titulo}`)
  console.log(`| Arquivo: ${arquivo}`)
  console.log(`| Banco (host): ${host}`)
  console.log(`| Branch do Neon: ${aval.branch}${aval.exigeConfirmacao ? '  <-- PRODUÇÃO' : ''}`)
  console.log('+----------------------------------------------------------+')
  if (!aval.exigeConfirmacao) return true
  const resp = await entrada.perguntar(`Digite "${aval.branch}" para confirmar: `)
  if (!confirmacaoValida(resp, aval.branch)) {
    console.error('Confirmação não confere. Nada foi feito.')
    return false
  }
  return true
}
