/**
 * Entrada interativa dos scripts. Com TTY: prompts normais e senha sem eco.
 * Sem TTY (stdin redirecionado, ex.: testes): cada resposta é uma linha do stdin, na ordem
 * das perguntas; a senha também vem do stdin, nunca de argumento de linha de comando.
 */
import { createInterface } from 'node:readline'

export interface Entrada {
  tty: boolean
  perguntar(texto: string): Promise<string>
  /** Senha sem eco (nunca imprime o que foi digitado). */
  perguntarSenha(texto: string): Promise<string>
}

async function lerTodoStdin(): Promise<string[]> {
  const partes: Buffer[] = []
  for await (const p of process.stdin) partes.push(Buffer.isBuffer(p) ? p : Buffer.from(p))
  return Buffer.concat(partes)
    .toString('utf8')
    .replace(new RegExp("^" + String.fromCharCode(0xfeff)), "")
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
}

export async function criarEntrada(): Promise<Entrada> {
  if (!process.stdin.isTTY) {
    const linhas = await lerTodoStdin()
    const proxima = (texto: string, eco: boolean) => {
      process.stdout.write(texto + (eco ? '' : '\n'))
      const l = linhas.shift()
      if (l === undefined) throw new Error('A entrada terminou antes de todas as respostas (stdin).')
      if (eco) process.stdout.write(`${l}\n`)
      return l
    }
    return {
      tty: false,
      perguntar: async (t) => proxima(t, true),
      perguntarSenha: async (t) => proxima(t, false),
    }
  }

  return {
    tty: true,
    perguntar: (texto) =>
      new Promise((res) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        rl.question(texto, (r) => {
          rl.close()
          res(r)
        })
      }),
    perguntarSenha: (texto) =>
      new Promise((res, rej) => {
        process.stdout.write(texto)
        const stdin = process.stdin
        stdin.setRawMode(true)
        stdin.resume()
        stdin.setEncoding('utf8')
        let senha = ''
        const fim = () => {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
        }
        const onData = (chunk: string) => {
          for (const c of chunk) {
            if (c === '\r' || c === '\n') {
              fim()
              res(senha)
              return
            }
            if (c.charCodeAt(0) === 3) /* Ctrl+C */ {
              fim()
              rej(new Error('Cancelado.'))
              return
            }
            if (c.charCodeAt(0) === 127 || c.charCodeAt(0) === 8) senha = senha.slice(0, -1) // Backspace
            else if (c >= ' ') senha += c
          }
        }
        stdin.on('data', onData)
      }),
  }
}
