/**
 * Lógica de "adicionar membro a um workspace".
 *
 * FERRAMENTA ADMINISTRATIVA LOCAL: o `app_user` não pode escrever em `workspace_members`
 * (o RLS só tem policy de SELECT, de propósito), então quem chama esta função precisa passar
 * um banco conectado como OWNER (DATABASE_URL_UNPOOLED). Nunca é importada pelo app
 * (sem `server-only` para poder rodar em scripts; só `scripts/adicionar-membro.ts` e testes a usam).
 */
import { and, eq, sql } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { user } from '../../db/auth-schema'
import { workspaceMembers, workspaces } from '../../db/schema'

// Qualquer instância do drizzle (neon-serverless) conectada como owner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOwner = NeonDatabase<any>

export type Candidato = { id: string; nome: string; tipo: string }

export type ResultadoAdicionarMembro =
  | { ok: true; resultado: 'adicionado' | 'ja_membro'; workspaceId: string; usuarioId: string }
  | { ok: false; motivo: 'dono_inexistente' | 'usuario_inexistente' | 'workspace_inexistente' | 'nao_e_dono' }
  | { ok: false; motivo: 'ambiguo'; candidatos: Candidato[] }

export type EntradaAdicionarMembro = {
  emailDono: string
  nomeWorkspace: string
  emailNovoMembro: string
}

const norm = (e: string) => e.trim().toLowerCase()

export async function adicionarMembro(
  db: DbOwner,
  entrada: EntradaAdicionarMembro,
): Promise<ResultadoAdicionarMembro> {
  return db.transaction(async (tx): Promise<ResultadoAdicionarMembro> => {
    const [dono] = await tx.select({ id: user.id }).from(user).where(eq(user.email, norm(entrada.emailDono))).limit(1)
    if (!dono) return { ok: false, motivo: 'dono_inexistente' }
    const [novo] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, norm(entrada.emailNovoMembro)))
      .limit(1)
    if (!novo) return { ok: false, motivo: 'usuario_inexistente' }

    const nome = entrada.nomeWorkspace.trim()
    const mesmoNome = sql`lower(${workspaces.nome}) = lower(${nome})`
    const doDono = await tx
      .select({ id: workspaces.id, nome: workspaces.nome, tipo: workspaces.tipo })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(and(eq(workspaceMembers.userId, dono.id), eq(workspaceMembers.papel, 'dono'), mesmoNome))
      .orderBy(workspaces.criadoEm, workspaces.id)

    if (doDono.length === 0) {
      // Distingue "não existe" de "existe, mas essa pessoa não é a dona".
      const comoMembro = await tx
        .select({ id: workspaces.id })
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(and(eq(workspaceMembers.userId, dono.id), mesmoNome))
        .limit(1)
      return { ok: false, motivo: comoMembro.length ? 'nao_e_dono' : 'workspace_inexistente' }
    }
    if (doDono.length > 1) return { ok: false, motivo: 'ambiguo', candidatos: doDono }

    const ws = doDono[0]
    const inseridos = await tx
      .insert(workspaceMembers)
      .values({ workspaceId: ws.id, userId: novo.id, papel: 'membro' })
      .onConflictDoNothing()
      .returning({ userId: workspaceMembers.userId })
    return {
      ok: true,
      resultado: inseridos.length ? 'adicionado' : 'ja_membro',
      workspaceId: ws.id,
      usuarioId: novo.id,
    }
  })
}

/** Mensagem em PT-BR para o resultado (usada pelo script). */
export function descreverResultado(r: ResultadoAdicionarMembro, e: EntradaAdicionarMembro): string {
  if (r.ok) {
    return r.resultado === 'adicionado'
      ? `Pronto: ${e.emailNovoMembro} agora é membro do workspace "${e.nomeWorkspace}".`
      : `${e.emailNovoMembro} já tem acesso ao workspace "${e.nomeWorkspace}". Nada a fazer.`
  }
  switch (r.motivo) {
    case 'dono_inexistente':
      return `Não existe usuário com o e-mail do dono: ${e.emailDono}.`
    case 'usuario_inexistente':
      return `Não existe usuário com o e-mail de quem entra: ${e.emailNovoMembro}. Crie antes com "npm run criar-usuario".`
    case 'workspace_inexistente':
      return `${e.emailDono} não tem nenhum workspace chamado "${e.nomeWorkspace}".`
    case 'nao_e_dono':
      return `${e.emailDono} participa de "${e.nomeWorkspace}", mas não é o dono dele. Só o dono pode ser indicado aqui.`
    case 'ambiguo':
      return [
        `${e.emailDono} é dono de mais de um workspace chamado "${e.nomeWorkspace}". Renomeie um deles no app e tente de novo. Candidatos:`,
        ...r.candidatos.map((c) => `  - ${c.id} (${c.tipo})`),
      ].join('\n')
  }
}
