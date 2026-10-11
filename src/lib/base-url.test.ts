import { describe, expect, it } from 'vitest'
import { resolverBaseUrl } from './base-url'

describe('resolverBaseUrl', () => {
  it('prefere BETTER_AUTH_URL', () => {
    expect(
      resolverBaseUrl({ BETTER_AUTH_URL: 'https://app.exemplo.com', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }),
    ).toBe('https://app.exemplo.com')
  })
  it('cai para VERCEL_PROJECT_PRODUCTION_URL com https://', () => {
    expect(resolverBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' })).toBe('https://x.vercel.app')
    expect(resolverBaseUrl({ BETTER_AUTH_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' })).toBe(
      'https://x.vercel.app',
    )
  })
  it('sem nada, undefined', () => {
    expect(resolverBaseUrl({})).toBeUndefined()
  })
})
