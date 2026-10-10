import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  date,
  foreignKey,
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
    // Alvo das FKs compostas (workspace_id, conta_id): impede referência entre workspaces.
    unique('contas_workspace_id_id_unique').on(t.workspaceId, t.id),
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
    unique('categorias_workspace_id_id_unique').on(t.workspaceId, t.id),
  ],
)

export const importacoes = pgTable(
  'importacoes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contaId: uuid('conta_id').notNull(),
    arquivoNome: text('arquivo_nome').notNull(),
    formato: text('formato').notNull(),
    qtdLancamentos: integer('qtd_lancamentos').notNull().default(0),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('importacoes_formato_check', sql`${t.formato} in ('ofx', 'csv')`),
    index('importacoes_workspace_idx').on(t.workspaceId),
    unique('importacoes_workspace_id_id_unique').on(t.workspaceId, t.id),
    foreignKey({
      name: 'importacoes_workspace_conta_fk',
      columns: [t.workspaceId, t.contaId],
      foreignColumns: [contas.workspaceId, contas.id],
    }).onDelete('cascade'),
  ],
)

export const lancamentos = pgTable(
  'lancamentos',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    contaId: uuid('conta_id').notNull(),
    categoriaId: uuid('categoria_id'),
    data: date('data', { mode: 'string' }).notNull(),
    descricao: text('descricao').notNull().default(''),
    valorCentavos: centavos('valor_centavos').notNull(),
    status: text('status').notNull().default('efetivado'),
    idExterno: text('id_externo'),
    importacaoId: uuid('importacao_id'),
    // Quem recebeu/pagou, como digitado ("Senhor Jeová"); `favorecido_chave` é a forma normalizada
    // (sem acentos/tratamento) usada para agrupar e filtrar. Ambos nulos ou ambos preenchidos.
    favorecido: text('favorecido'),
    favorecidoChave: text('favorecido_chave'),
    // Desempate na ordenação da listagem (data desc, criado_em desc).
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('lancamentos_status_check', sql`${t.status} in ('efetivado', 'pendente')`),
    unique('lancamentos_conta_id_externo_unique').on(t.contaId, t.idExterno),
    index('lancamentos_workspace_data_idx').on(t.workspaceId, t.data),
    index('lancamentos_workspace_favorecido_data_idx').on(t.workspaceId, t.favorecidoChave, t.data),
    check(
      'lancamentos_favorecido_check',
      sql`${t.favorecido} is null or char_length(${t.favorecido}) between 1 and 80`,
    ),
    check(
      'lancamentos_favorecido_chave_check',
      sql`${t.favorecidoChave} is null or char_length(${t.favorecidoChave}) between 1 and 80`,
    ),
    check(
      'lancamentos_favorecido_consistente_check',
      sql`(${t.favorecido} is null) = (${t.favorecidoChave} is null)`,
    ),
    foreignKey({
      name: 'lancamentos_workspace_conta_fk',
      columns: [t.workspaceId, t.contaId],
      foreignColumns: [contas.workspaceId, contas.id],
    }).onDelete('cascade'),
    // Na migração o `set null` vira `set null (categoria_id)` (anula só a coluna nullable;
    // workspace_id é NOT NULL). O drizzle-kit não expressa essa sintaxe.
    foreignKey({
      name: 'lancamentos_workspace_categoria_fk',
      columns: [t.workspaceId, t.categoriaId],
      foreignColumns: [categorias.workspaceId, categorias.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'lancamentos_workspace_importacao_fk',
      columns: [t.workspaceId, t.importacaoId],
      foreignColumns: [importacoes.workspaceId, importacoes.id],
    }).onDelete('set null'),
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
    categoriaId: uuid('categoria_id').notNull(),
    prioridade: integer('prioridade').notNull().default(0),
  },
  (t) => [
    index('regras_categoria_workspace_idx').on(t.workspaceId),
    foreignKey({
      name: 'regras_categoria_workspace_categoria_fk',
      columns: [t.workspaceId, t.categoriaId],
      foreignColumns: [categorias.workspaceId, categorias.id],
    }).onDelete('cascade'),
  ],
)

export const orcamentos = pgTable(
  'orcamentos',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    categoriaId: uuid('categoria_id').notNull(),
    mes: date('mes', { mode: 'string' }).notNull(),
    valorCentavos: centavos('valor_centavos').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.categoriaId, t.mes] }),
    check('orcamentos_mes_dia1_check', sql`extract(day from ${t.mes}) = 1`),
    index('orcamentos_workspace_idx').on(t.workspaceId),
    foreignKey({
      name: 'orcamentos_workspace_categoria_fk',
      columns: [t.workspaceId, t.categoriaId],
      foreignColumns: [categorias.workspaceId, categorias.id],
    }).onDelete('cascade'),
  ],
)

export const metas = pgTable(
  'metas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    valorAlvoCentavos: centavos('valor_alvo_centavos').notNull(),
    dataAlvo: date('data_alvo', { mode: 'string' }).notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    // Marcado/limpo automaticamente quando o guardado (soma dos aportes) cruza o alvo.
    concluidaEm: timestamp('concluida_em', { withTimezone: true }),
  },
  (t) => [
    check('metas_nome_check', sql`char_length(${t.nome}) between 1 and 80`),
    check('metas_valor_alvo_check', sql`${t.valorAlvoCentavos} > 0`),
    index('metas_workspace_idx').on(t.workspaceId),
    // Alvo da FK composta de aportes_meta.
    unique('metas_workspace_id_id_unique').on(t.workspaceId, t.id),
  ],
)

export const aportesMeta = pgTable(
  'aportes_meta',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    metaId: uuid('meta_id').notNull(),
    data: date('data', { mode: 'string' }).notNull(),
    // Retirada = valor negativo.
    valorCentavos: centavos('valor_centavos').notNull(),
    observacao: text('observacao'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('aportes_meta_valor_check', sql`${t.valorCentavos} <> 0`),
    check('aportes_meta_observacao_check', sql`${t.observacao} is null or char_length(${t.observacao}) <= 200`),
    index('aportes_meta_workspace_meta_data_idx').on(t.workspaceId, t.metaId, t.data),
    foreignKey({
      name: 'aportes_meta_workspace_meta_fk',
      columns: [t.workspaceId, t.metaId],
      foreignColumns: [metas.workspaceId, metas.id],
    }).onDelete('cascade'),
  ],
)

/**
 * Limites editáveis do orientador (uma linha por workspace; sem linha = padrões 15/30/30 aplicados no código).
 * Percentuais inteiros: categoria 1-100, alta 1-500 (pode passar de 100% sobre a média), cartão 1-100.
 */
export const configOrientador = pgTable(
  'config_orientador',
  {
    workspaceId: uuid('workspace_id')
      .primaryKey()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    limiteCategoriaPct: integer('limite_categoria_pct').notNull().default(15),
    altaPct: integer('alta_pct').notNull().default(30),
    cartaoPct: integer('cartao_pct').notNull().default(30),
  },
  (t) => [
    check('config_orientador_limite_categoria_check', sql`${t.limiteCategoriaPct} between 1 and 100`),
    check('config_orientador_alta_check', sql`${t.altaPct} between 1 and 500`),
    check('config_orientador_cartao_check', sql`${t.cartaoPct} between 1 and 100`),
  ],
)

/**
 * Alertas dispensados no mês. `chave` identifica a instância (id da categoria/meta; '' para regras globais).
 * O alerta volta se a severidade subir (o app compara com `severidade`) ou no mês seguinte (`mes` muda).
 */
export const alertasDispensados = pgTable(
  'alertas_dispensados',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    regraId: text('regra_id').notNull(),
    chave: text('chave').notNull(),
    mes: date('mes', { mode: 'string' }).notNull(),
    severidade: text('severidade').notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.regraId, t.chave, t.mes] }),
    check('alertas_dispensados_mes_dia1_check', sql`extract(day from ${t.mes}) = 1`),
    check('alertas_dispensados_severidade_check', sql`${t.severidade} in ('critico', 'atencao', 'info', 'positivo')`),
    check('alertas_dispensados_regra_check', sql`char_length(${t.regraId}) between 1 and 40`),
    check('alertas_dispensados_chave_check', sql`char_length(${t.chave}) <= 64`),
  ],
)
