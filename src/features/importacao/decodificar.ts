/**
 * Decodifica os bytes de um arquivo de extrato: UTF-8 estrito; se houver sequência
 * inválida (típico de OFX 1.x do Itaú/Bradesco), cai para latin1 (windows-1252 no WHATWG).
 */
export function decodificarArquivo(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('latin1').decode(bytes)
  }
}
