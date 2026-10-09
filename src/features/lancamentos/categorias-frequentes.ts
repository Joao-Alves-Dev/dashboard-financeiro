import { somarDias } from '@/features/dashboard/periodo'

/** Janela (em dias antes de hoje) usada para ranquear as categorias mais usadas. */
export const JANELA_DIAS = 60

/** De `hoje - 60 dias` a `hoje`, inclusive nas duas pontas (aritmética por string, sem fuso). */
export function janelaCategoriasFrequentes(hoje: string): { de: string; ate: string } {
  return { de: somarDias(hoje, -JANELA_DIAS), ate: hoje }
}

/** Conta do cookie se pertencer ao workspace; senão a primeira; sem contas, null. */
export function escolherContaPadrao(contas: { id: string }[], cookieId: string | undefined): string | null {
  if (cookieId && contas.some((c) => c.id === cookieId)) return cookieId
  return contas[0]?.id ?? null
}
