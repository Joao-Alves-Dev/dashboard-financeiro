import { describe, expect, it } from 'vitest'
import { HEADERS_SEGURANCA, regrasDeHeaders } from './headers-seguranca'

const valor = (chave: string) => HEADERS_SEGURANCA.find((h) => h.key === chave)?.value

describe('headers de segurança', () => {
  it('tem todas as chaves esperadas, sem repetição', () => {
    const chaves = HEADERS_SEGURANCA.map((h) => h.key)
    expect(chaves.sort()).toEqual(
      [
        'Permissions-Policy',
        'Referrer-Policy',
        'Strict-Transport-Security',
        'X-Content-Type-Options',
        'X-Frame-Options',
      ].sort(),
    )
  })

  it('valores', () => {
    expect(valor('X-Content-Type-Options')).toBe('nosniff')
    expect(valor('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(valor('X-Frame-Options')).toBe('DENY')
    expect(valor('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains')
  })

  it('o microfone continua liberado para o próprio site (lançamento por voz)', () => {
    const pp = valor('Permissions-Policy') ?? ''
    expect(pp.split(',').map((p) => p.trim())).toContain('microphone=(self)')
    expect(pp).not.toMatch(/microphone=\(\)/)
    for (const bloqueado of ['camera=()', 'geolocation=()', 'payment=()', 'usb=()']) expect(pp).toContain(bloqueado)
  })

  it('não há CSP aplicada (só seria Report-Only)', () => {
    expect(valor('Content-Security-Policy')).toBeUndefined()
  })

  it('a regra cobre todas as rotas', () => {
    expect(regrasDeHeaders()).toEqual([{ source: '/(.*)', headers: HEADERS_SEGURANCA }])
  })
})
