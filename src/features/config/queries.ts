import 'server-only'
import { exigirUsuario } from '@/lib/sessao'
import {
  listarCategoriasDoUsuario,
  listarContasDoUsuario,
  listarRegrasDoUsuario,
  type Categoria,
  type ContaComContagem,
  type RegraDb,
} from './servico'

export type { Categoria, ContaComContagem, RegraDb }

export async function listarContas(ws: string): Promise<ContaComContagem[]> {
  const u = await exigirUsuario()
  return listarContasDoUsuario(u.id, ws)
}

export async function listarCategorias(ws: string): Promise<Categoria[]> {
  const u = await exigirUsuario()
  return listarCategoriasDoUsuario(u.id, ws)
}

export async function listarRegras(ws: string): Promise<RegraDb[]> {
  const u = await exigirUsuario()
  return listarRegrasDoUsuario(u.id, ws)
}
