/**
 * Headers HTTP de segurança aplicados a todas as rotas (next.config.ts → headers()).
 * Auditoria de segurança (2026-10-12).
 *
 * - Permissions-Policy: o app USA o microfone (reconhecimento de voz do navegador), por isso
 *   `microphone=(self)`; o resto que o app não usa fica bloqueado.
 * - Sem Content-Security-Policy aplicada: uma CSP restritiva pode quebrar scripts do Next e
 *   do next-intl; o clickjacking já é coberto por X-Frame-Options.
 */
export type HeaderHttp = { key: string; value: string }

export const HEADERS_SEGURANCA: HeaderHttp[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=(), payment=(), usb=()' },
]

export function regrasDeHeaders(): { source: string; headers: HeaderHttp[] }[] {
  return [{ source: '/(.*)', headers: HEADERS_SEGURANCA }]
}
