import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema'

const centavos = (nome: string) => bigint(nome, { mode: 'number' })

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    nome: text('nome').notNull(),
    tipo: text('tipo').notNull(),
    criadoPor: text('criado_por')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('workspaces_tipo_check', sql`${t.tipo} in ('pessoal', 'empresa')`)],
)

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    papel: text('papel').notNull().default('dono'),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    check('workspace_members_papel_check', sql`${t.papel} in ('dono', 'membro')`),
    index('workspace_members_user_idx').on(t.userId),
  ],
)

export const contas = pgTable(
  'contas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    tipo: text('tipo').notNull(),
    saldoInicialCentavos: centavos('saldo_inicial_centavos').notNull().default(0),
    mapeamentoCsv: jsonb('mapeamento_csv'),
  },
  (t) => [
    check('contas_tipo_check', sql`${t.tipo} in ('corrente', 'cartao', 'dinheiro')`),
    index('contas_workspace_idx').on(t.workspaceId),
  ],
)

export const categorias = pgTable(
  'categorias',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    natureza: text('natureza').notNull(),
    cor: text('cor').notNull().default('#64748b'),
  },
  (t) => [
    check('categorias_natureza_check', sql`${t.natureza} in ('receita', 'despesa')`),
    index('categorias_workspace_idx').on(t.workspaceId),
  ],
)

export const importacoes = pgTable(
  'importacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contaId: uuid('conta_id')
      .notNull()
      .references(() => contas.id, { onDelete: 'cascade' }),
    arquivoNome: text('arquivo_nome').notNull(),
    formato: text('formato').notNull(),
    qtdLancamentos: integer('qtd_lancamentos').notNull().default(0),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('importacoes_formato_check', sql`${t.formato} in ('ofx', 'csv')`),
    index('importacoes_workspace_idx').on(t.workspaceId),
  ],
)

export const lancamentos = pgTable(
  'lancamentos',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contaId: uuid('conta_id')
      .notNull()
      .references(() => contas.id, { onDelete: 'cascade' }),
    categoriaId: uuid('categoria_id').references(() => categorias.id, { onDelete: 'set null' }),
    data: date('data', { mode: 'string' }).notNull(),
    descricao: text('descricao').notNull().default(''),
    valorCentavos: centavos('valor_centavos').notNull(),
    status: text('status').notNull().default('efetivado'),
    idExterno: text('id_externo'),
    importacaoId: uuid('importacao_id').references(() => importacoes.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('lancamentos_status_check', sql`${t.status} in ('efetivado', 'pendente')`),
    unique('lancamentos_conta_id_externo_unique').on(t.contaId, t.idExterno),
    index('lancamentos_workspace_data_idx').on(t.workspaceId, t.data),
  ],
)

export const regrasCategoria = pgTable(
  'regras_categoria',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    padrao: text('padrao').notNull(),
    categoriaId: uuid('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'cascade' }),
    prioridade: integer('prioridade').notNull().default(0),
  },
  (t) => [index('regras_categoria_workspace_idx').on(t.workspaceId)],
)

export const orcamentos = pgTable(
  'orcamentos',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    categoriaId: uuid('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'cascade' }),
    mes: date('mes', { mode: 'string' }).notNull(),
    valorCentavos: centavos('valor_centavos').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.categoriaId, t.mes] }),
    check('orcamentos_mes_dia1_check', sql`extract(day from ${t.mes}) = 1`),
    index('orcamentos_workspace_idx').on(t.workspaceId),
  ],
)
