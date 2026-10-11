/**
 * URL base pública do app para o Better Auth.
 * Ordem: BETTER_AUTH_URL; senão VERCEL_PROJECT_PRODUCTION_URL (a Vercel entrega só o host,
 * sem protocolo, por isso o prefixo https://); senão undefined (o Better Auth então usa o que
 * ele próprio lê do ambiente / infere da requisição).
 * Obs.: o Better Auth confia por padrão na origem do baseURL (trustedOrigins) e marca cookies
 * como Secure quando NODE_ENV=production (a Vercel serve sempre em HTTPS).
 */
export function resolverBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const explicita = env.BETTER_AUTH_URL?.trim()
  if (explicita) return explicita
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return /^https?:\/\//i.test(vercel) ? vercel : `https://${vercel}`
  return undefined
}
