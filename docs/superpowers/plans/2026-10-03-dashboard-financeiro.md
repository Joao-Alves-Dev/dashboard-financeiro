# Dashboard Financeiro — Implementation Plan

> Revisão 2 (2026-10-03): Tasks 12-16 adicionadas (edições, metas, PWA, orientador, publicação pessoal); demo e E2E renumeradas para 17-18.
> Revisão 5 (2026-10-08): Tasks 14b (favorecido) e 15b (exportação de lista por favorecido e período, tela e voz) adicionadas; a Task 15 passa a extrair `favorecido`.
> Revisão 4 (2026-10-05): Task 15 (lançamento por voz) adicionada; orientador → 16, publicação pessoal → 17 (inclui conta do pai e membro), demo → 18, E2E → 19.
> Revisão 3 (2026-10-05): Supabase → Neon + Better Auth + Drizzle. Tasks 3, 7, 16 e 17 reescritas; nas demais, "migração" = arquivo SQL em `db/migrations/` criado com `npx drizzle-kit generate --custom --name <nome>` e aplicado com `npm run db:migrate`; chamadas a funções SQL usam `tx.execute(sql\`select ...\`)` dentro de `comUsuario`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a v1 do dashboard financeiro (Pessoal/Empresa, importação CSV/OFX, orçamento vs realizado, demo isolada) publicada na Vercel.

**Architecture:** Next.js App Router com Server Actions; Neon Postgres com RLS por workspace (usuário informado por `set_config` em cada transação); Better Auth para login; agregações e importação atômica em funções SQL; lógica de parsing em funções puras testadas com Vitest.

**Tech Stack:** Next.js + TypeScript, Tailwind, shadcn/ui, Recharts, Zod, Drizzle ORM + drizzle-kit, @neondatabase/serverless (Pool/WebSocket), Better Auth, next-intl, Papaparse, Vitest, Playwright, GitHub Actions, Vercel.

**Docs obrigatórias antes de codar:** Better Auth (instalação Next.js, adaptador Drizzle, `emailAndPassword` com bloqueio de cadastro, plugin anônimo) e Drizzle + Neon (`drizzle-orm/neon-serverless`). Ler a documentação oficial atual; não confiar em memória. Next 16: ver `node_modules/next/dist/docs/` (AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-10-03-dashboard-financeiro-design.md` (seção acima neste arquivo).

## Pré-requisitos manuais (feitos pelo usuário)

1. Criar conta no Neon (neon.com) e o projeto `financeiro-pessoal` (região mais próxima disponível, ex.: AWS São Paulo se houver) com uma branch `dev`. O projeto `financeiro-portfolio` só na Task 18.
2. ~~Criar repositório público no GitHub~~ (feito).
3. Preencher `.env.local` (nunca commitado; `scripts/criar-env-local.ps1` gera): `DATABASE_URL_UNPOOLED` (owner, conexão direta, só migrações) e `DATABASE_URL` (branch `dev`, **pooled**, role `app_user` sem BYPASSRLS, preenchida por `npm run db:criar-role-app` depois do `criar-env-local`; o owner `neondb_owner` tem BYPASSRLS no Neon e não pode ser usado pelo app), `BETTER_AUTH_SECRET` (gerar com `npx auth@latest secret` ou 32+ bytes aleatórios), `BETTER_AUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_EDICAO=pessoal`, `CRON_SECRET`.

Pasta do projeto: `D:\Portfolio\dashboard-financeiro` (mover a sessão para lá com `change_directory` antes da Task 1).

**Execução:** Native (superpowers:executing-plans). Tasks 1-2 concluídas (commits da01f89, df04c1f).

## Global Constraints

- Dinheiro sempre em centavos inteiros (`number` no TS, `bigint` no Postgres); nunca float para valores.
- Datas de lançamento como string `YYYY-MM-DD` / tipo `date`; nunca converter via `new Date()` com fuso.
- Todo texto de UI vem de `messages/pt-BR.json` via next-intl.
- Server Actions retornam `ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string; campos?: Record<string, string> }`.
- Toda leitura/escrita de tabela de domínio passa por `comUsuario(userId, fn)` (Task 3). Acesso fora dele só nas tabelas do Better Auth, em `src/app/api/demo/limpar/route.ts` e nos helpers de teste.
- Banco só no servidor (`import 'server-only'` em `src/db/*`).
- `DATABASE_URL` (app e testes) = role `app_user` pooled, sem BYPASSRLS; `DATABASE_URL_UNPOOLED` = owner, só para `drizzle-kit`. A Vercel recebe sempre a URL do `app_user`, nunca a do owner.
- Nomes de domínio em português (tabelas, colunas, funções), conforme o spec.

## Review Focus

1. **Duas transações idênticas no mesmo dia** (dois cafés de R$ 5,00): ambas entram; reimportar o arquivo não duplica nenhuma. → Task 6.
2. **Valor com vírgula decimal e milhar** (`-1.234,56`, `R$ 1.234,56`, `1234.56` no OFX): todos viram o mesmo número de centavos. → Tasks 2 e 5.
3. **Arquivo Latin-1 com acentos** (`PADARIA SÃO JOSÉ`): descrição preservada, sem `�`. → Task 5.
4. **CSV de cartão com compras positivas** (padrão Nubank cartão): `inverterSinal` transforma compras em saídas. → Task 4.
5. **Lançamento em 31/12 ou 01/01**: cai no mês correto no resumo mensal (sem deslocamento de fuso). → Tasks 4 e 10.

---

### Task 1: Scaffold, qualidade e CI

**Files:** Create: projeto Next.js (TS, Tailwind, ESLint, App Router, `src/`), `vitest.config.ts`, `messages/pt-BR.json`, `src/i18n/request.ts`, `.github/workflows/ci.yml`, `.env.example`, `.gitignore` (inclui `.env*.local`).

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*"`; `npx shadcn@latest init`; instalar `@supabase/ssr @supabase/supabase-js zod next-intl recharts papaparse`; dev: `vitest @types/papaparse @playwright/test`.
- [ ] **Step 2:** Configurar next-intl sem prefixo de rota (locale fixo `pt-BR`).
- [ ] **Step 3:** Scripts `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`, `"test:integracao": "vitest run tests/integracao"` (excluir `tests/integracao` do `test` padrão). Teste fumaça `src/lib/smoke.test.ts`.
- [ ] **Step 4:** CI em `push`: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`.
- [ ] **Step 5: Verificar:** `npm run lint && npm run typecheck && npm test && npm run build` → todos passam.
- [ ] **Step 6:** `git init`, commit `chore: scaffold do projeto`, push; CI verde.

### Task 2: `money.ts`

**Files:** Create `src/lib/money.ts`; Test `src/lib/money.test.ts`.

**Interfaces — Produces:** `parseValorBR(s: string): number | null` (centavos); `formatarBRL(centavos: number): string`.

- [ ] **Step 1: Testes que falham:**
```ts
expect(parseValorBR('1.234,56')).toBe(123456)
expect(parseValorBR('-1.234,56')).toBe(-123456)
expect(parseValorBR('R$ 10,00')).toBe(1000)
expect(parseValorBR('(10,00)')).toBe(-1000)
expect(parseValorBR('1234.56')).toBe(123456)
expect(parseValorBR('1.234')).toBe(123400)
expect(parseValorBR('abc')).toBeNull()
expect(formatarBRL(-123456).replace(/\s/g, ' ')).toBe('-R$ 1.234,56')
```
- [ ] **Step 2:** `npm test -- money` → FAIL.
- [ ] **Step 3:** Implementar. Regra: com vírgula, ela é decimal e pontos são milhar; sem vírgula, ponto seguido de 1-2 dígitos finais é decimal, senão milhar. Conversão por string (sem multiplicar float). `formatarBRL` via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- [ ] **Step 4:** PASS. **Step 5:** commit `feat: utilitários de dinheiro`.

### Task 3: Banco Neon, esquema, RLS e teste de isolamento

**Files:** Create `drizzle.config.ts`, `scripts/criar-role-app.ts` (script `db:criar-role-app`: cria/rotaciona `app_user` e reescreve só `DATABASE_URL` no `.env.local`, ou em `--arquivo <path>`), `src/db/{cliente.ts,schema.ts,auth-schema.ts,com-usuario.ts}`, `db/migrations/*` (gerados), migrações customizadas `db/migrations/*_rls.sql`, `*_funcoes_workspace.sql`, `*_grants_app_user.sql` (grants e default privileges para `app_user`; a role precisa existir antes de `db:migrate`); Test `tests/integracao/rls.test.ts`, helper `tests/integracao/usuarios.ts` (insere/apaga linhas em `user` diretamente). Scripts `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`). Deps: `drizzle-orm @neondatabase/serverless ws better-auth server-only`; dev: `drizzle-kit @types/ws dotenv`. **Remover** `@supabase/ssr @supabase/supabase-js` (instalados na Task 1) e trocar as variáveis do `.env.example` pelas da seção de pré-requisitos.

**Interfaces — Produces:**
```ts
// src/db/cliente.ts — Pool WebSocket (neonConfig.webSocketConstructor = ws em Node)
export const db: NeonDatabase<typeof schema>
// src/db/com-usuario.ts
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export async function comUsuario<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>
// abre db.transaction, executa sql`select set_config('app.usuario_id', ${userId}, true)`, depois fn(tx)
```
SQL: `usuario_atual() returns text`; `is_member(ws uuid) returns boolean`; `criar_workspace(p_nome text, p_tipo text) returns uuid` (insere workspace com `criado_por = usuario_atual()`, membro `dono` e categorias padrão do tipo; erro se `usuario_atual()` for nulo). Tabelas do Better Auth geradas com `npx auth@latest generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y` para `src/db/auth-schema.ts` (o CLI exige remover `import 'server-only'` de `auth.ts`/`cliente.ts` temporariamente).

Categorias padrão — pessoal: Salário, Outras receitas, Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Outros. Empresa: Vendas, Serviços, Outras receitas, Fornecedores, Folha, Impostos, Aluguel, Marketing, Outros.

- [ ] **Step 1: Teste que falha** (`rls.test.ts`, usuários A e B inseridos em `user` pelo helper e apagados no `afterAll`):
  - `comUsuario(A, tx => tx.execute(sql\`select criar_workspace('Casa', 'pessoal')\`))` retorna id; A insere conta e lançamento.
  - `comUsuario(B, tx => tx.select().from(lancamentos))` → `[]`.
  - `comUsuario(B, tx => tx.insert(lancamentos).values({ workspaceId: wsA, ... }))` → rejeita (violação de política).
  - `comUsuario(B, ...)` select em `workspaces` por `wsA` → `[]`.
  - `db.select().from(lancamentos)` **sem** `comUsuario` → `[]` (falha fechado).
  - A vê 9 categorias padrão.
  - a conexão do app tem `rolbypassrls = false` em `pg_roles` (falha se alguém usar o owner).
- [ ] **Step 2:** Configurar `drizzle.config.ts` (`dialect: 'postgresql'`, `schema: './src/db/*schema.ts'`, `out: './db/migrations'`, url de `DATABASE_URL` via dotenv `.env.local`); rodar teste → FAIL (tabelas inexistentes).
- [ ] **Step 3:** Schema Drizzle das tabelas do spec (domínio + auth). `npm run db:generate`. Migrações customizadas: `usuario_atual`, `is_member` (`security definer`, `stable`, `set search_path = public`), `enable` + `force row level security` em todas as tabelas de domínio, policies `for all using (is_member(workspace_id)) with check (is_member(workspace_id))`; `workspaces`: select/update por `is_member(id)`, insert só via `criar_workspace` (`security definer`). Índices: `lancamentos(workspace_id, data)`, unique `(conta_id, id_externo)`.
- [ ] **Step 4:** `npm run db:migrate` (branch `dev`); `npm run test:integracao` → PASS.
- [ ] **Step 5:** commit `feat: banco Neon, esquema, RLS e criação de workspace`.

### Task 4: Parser CSV

**Files:** Create `src/features/importacao/tipos.ts`, `parse-csv.ts`; Test `parse-csv.test.ts`; fixtures em `src/features/importacao/__fixtures__/`.

**Interfaces — Consumes:** `parseValorBR`. **Produces:**
```ts
type LinhaImportada = { linha: number; data: string; descricao: string; valorCentavos: number; idExterno?: string }
type ErroLinha = { linha: number; motivo: string }
type ResultadoParse = { linhas: LinhaImportada[]; erros: ErroLinha[] }
type MapeamentoCsv = { colData: string; colDescricao: string; colValor: string; inverterSinal: boolean }
detectarColunasCsv(texto: string): string[]
parseCsv(texto: string, m: MapeamentoCsv): ResultadoParse
```

- [ ] **Step 1: Testes que falham:**
  - separadores `;` e `,` detectados automaticamente.
  - `15/03/2026` → `'2026-03-15'`; `2026-03-15` aceito; `31/12/2026` → `'2026-12-31'`.
  - data `32/01/2026` → em `erros` com `motivo: 'data inválida'`; as demais linhas seguem.
  - `inverterSinal: true` com `50,00` → `-5000`.
  - BOM inicial não aparece no nome da primeira coluna.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (Papaparse `header: true, delimiter: ''`; validar data por aritmética, sem `new Date`). **Step 4:** PASS. **Step 5:** commit.

### Task 5: Parser OFX e decodificação

**Files:** Create `src/features/importacao/decodificar.ts`, `parse-ofx.ts`; Test `parse-ofx.test.ts`; fixtures `itau.ofx` (SGML 1.x, Latin-1), `nubank.ofx` (XML 2.x, UTF-8), `inter.ofx`.

**Interfaces — Produces:** `decodificarArquivo(bytes: Uint8Array): string` (tenta `TextDecoder('utf-8', { fatal: true })`, cai para `latin1`); `parseOfx(texto: string): ResultadoParse` (`idExterno` = FITID).

- [ ] **Step 1: Testes que falham:**
  - Itaú SGML (tags sem fechamento) → N linhas; `DTPOSTED 20260315120000[-3:BRT]` → `'2026-03-15'`.
  - `TRNAMT -1234.56` e `TRNAMT -1234,56` → `-123456`.
  - bytes Latin-1 de `PADARIA SÃO JOSÉ` → descrição exata após `decodificarArquivo`.
  - descrição = `MEMO`; se vazio, `NAME`.
  - `STMTTRN` sem `FITID` → `idExterno` indefinido.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar com regex por bloco `<STMTTRN>…</STMTTRN>` e leitura de cada tag até `<` ou fim de linha (cobre SGML e XML). **Step 4:** PASS. **Step 5:** commit.

### Task 6: IDs externos e regras de categoria

**Files:** Create `src/features/importacao/id-externo.ts`, `aplicar-regras.ts`; Tests correspondentes.

**Interfaces — Produces:**
```ts
atribuirIdsExternos(linhas: LinhaImportada[]): (LinhaImportada & { idExterno: string })[]
type Regra = { padrao: string; categoriaId: string; prioridade: number }
aplicarRegras<T extends { descricao: string }>(linhas: T[], regras: Regra[]): (T & { categoriaId: string | null })[]
```

- [ ] **Step 1: Testes que falham:**
  - linha com `idExterno` (OFX) mantém o valor.
  - duas linhas idênticas recebem ids **diferentes**; reprocessar o mesmo array gera os **mesmos** ids.
  - `'uber'` casa `'UBER *TRIP'`; com duas regras casando vence maior `prioridade`; sem match → `null`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar: `csv:` + SHA-256 de `data|valor|descricaoNormalizada|indiceOcorrencia` (normalizada = trim, maiúsculas, espaços colapsados). **Step 4:** PASS. **Step 5:** commit.

### Task 7: Autenticação, workspaces e layout

**Files:** Create `src/lib/auth.ts` (instância Better Auth: `drizzleAdapter(db, { provider: 'pg', schema })`, `emailAndPassword: { enabled: true }`, plugin `nextCookies`), `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`, `src/lib/sessao.ts`, proteção de rotas (no Next 16 o antigo `middleware.ts` pode ter outro nome; conferir em `node_modules/next/dist/docs/`), `src/lib/action-result.ts`, `src/app/login/{page.tsx,actions.ts}`, `src/app/cadastro/page.tsx`, `src/app/novo/{page.tsx,actions.ts}`, `src/app/w/[id]/layout.tsx`, `src/features/workspaces/{queries.ts,seletor-workspace.tsx}`.

**Interfaces — Consumes:** `db`, `comUsuario` (Task 3). **Produces:** `exigirUsuario(): Promise<{ id: string; nome: string; isAnonymous: boolean }>` (redireciona para `/login` sem sessão); `obterWorkspace(id: string): Promise<Workspace>` (via `comUsuario`; `notFound()` quando RLS não retorna linha ou id não é uuid); `listarWorkspaces(): Promise<Workspace[]>`; type `ActionResult<T>`.

- [ ] **Step 1:** Configurar Better Auth conforme doc atual; login, cadastro e logout por e-mail e senha; proteção redireciona não autenticados de `/w/*` e `/novo` para `/login` (checagem otimista por cookie na borda + `exigirUsuario()` em cada página/action, que é a checagem real).
- [ ] **Step 2:** `/novo` (Zod: nome 2-60 chars, tipo `pessoal|empresa`) → `comUsuario(u.id, tx => tx.execute(sql\`select criar_workspace(...)\`))` → redirect `/w/[id]`.
- [ ] **Step 3:** Layout `/w/[id]`: cabeçalho, navegação (Dashboard, Lançamentos, Importar, Orçamento, Config), seletor de workspace com badge do tipo.
- [ ] **Step 4: Verificar:** criar conta, criar workspace Pessoal e Empresa, alternar; `/w/<uuid aleatório>` → 404; lint/typecheck/test verdes.
- [ ] **Step 5:** Primeiro deploy na Vercel com env vars; commit `feat: auth e workspaces`.

### Task 8: Contas, categorias, regras e lançamentos (CRUD)

**Files:** Create `src/features/lancamentos/{queries.ts,actions.ts,schemas.ts,tabela-lancamentos.tsx,form-lancamento.tsx}`, `src/features/config/{actions.ts,schemas.ts,...componentes}`; páginas `src/app/w/[id]/lancamentos/page.tsx`, `src/app/w/[id]/config/page.tsx`.

**Interfaces — Produces:** `listarLancamentos(ws: string, f: { de?: string; ate?: string; contaId?: string; categoriaId?: string; texto?: string; pagina: number }): Promise<{ itens: Lancamento[]; total: number }>` (50 por página); actions `criarLancamento`, `editarLancamento`, `excluirLancamento`, `categorizarEmLote(ids: string[], categoriaId: string)`; CRUD de `contas`, `categorias`, `regras_categoria`.

- [ ] **Step 1: Teste que falha** (`schemas.test.ts`): `{ valor: '1.234,56', tipo: 'saida' }` → `valorCentavos: -123456`; rejeita data inválida e descrição vazia.
- [ ] **Step 2:** FAIL → implementar schemas → PASS.
- [ ] **Step 2b (integridade entre workspaces):** migração trocando as FKs simples por FKs compostas, para que um lançamento/regra/orçamento/importação só possa referenciar conta/categoria do **mesmo** workspace: `unique (workspace_id, id)` em `contas` e `categorias`; FKs `(workspace_id, conta_id) references contas(workspace_id, id)` e `(workspace_id, categoria_id) references categorias(workspace_id, id)` (manter `on delete` atuais; para `categoria_id` nulo use `match simple`). Teste de integração: A tentando inserir lançamento no próprio workspace com `conta_id` de B → erro de FK.
- [ ] **Step 3:** Queries, actions e páginas; filtros nos `searchParams`; no tipo Empresa o form exibe `status`.
- [ ] **Step 4: Verificar:** CRUD, filtros, categorização em lote; excluir conta com lançamentos pede confirmação.
- [ ] **Step 5:** commit `feat: CRUD de lançamentos e configurações`.

### Task 9: Importação (SQL + fluxo)

**Files:** Create migração `importacao`; `src/features/importacao/{actions.ts,fluxo-importacao.tsx,previa.tsx,historico.tsx}`; `src/app/w/[id]/importar/page.tsx`; Test `tests/integracao/importacao.test.ts`.

**Interfaces — Consumes:** `decodificarArquivo`, `parseOfx`, `parseCsv`, `detectarColunasCsv`, `atribuirIdsExternos`, `aplicarRegras`. **Produces:** SQL `importar_lancamentos(p_ws uuid, p_conta uuid, p_arquivo text, p_formato text, p_linhas jsonb) returns table(importacao_id uuid, inseridos int, ignorados int)`; `desfazer_importacao(p_id uuid) returns void`; actions `previaImportacao(fd: FormData): Promise<ActionResult<{ linhas: (LinhaImportada & { idExterno: string; categoriaId: string | null; duplicado: boolean })[]; erros: ErroLinha[]; colunasCsv?: string[] }>>` e `confirmarImportacao(ws, contaId, arquivo, formato, linhas): Promise<ActionResult<{ inseridos: number; ignorados: number }>>`.

- [ ] **Step 1: Teste de integração que falha:** importar 3 linhas → `inseridos 3`; reimportar → `inseridos 0, ignorados 3`; `desfazer_importacao` remove as 3; usuário de outro workspace recebe erro.
- [ ] **Step 2:** FAIL → migração (`security invoker`, `on conflict (conta_id, id_externo) do nothing`) → PASS.
- [ ] **Step 3:** UI: upload (máx. 2 MB, `.ofx`/`.csv`); mapeamento CSV salvo em `contas.mapeamento_csv` e pré-preenchido depois; prévia com duplicados acinzentados e erros listados; confirmar; histórico com "Desfazer".
- [ ] **Step 4: Verificar** no navegador com as fixtures das Tasks 4 e 5.
- [ ] **Step 5:** commit `feat: importação de extratos`.

### Task 10: Dashboard

**Files:** Create migração `dashboard`; `src/features/dashboard/{queries.ts,kpis.tsx,grafico-mensal.tsx,grafico-categorias.tsx,orcamento-resumo.tsx,a-pagar-receber.tsx}`; `src/app/w/[id]/page.tsx`; Test `tests/integracao/dashboard.test.ts`.

**Interfaces — Produces:** `resumo_mensal(p_ws uuid, p_de date, p_ate date) returns table(mes date, entradas bigint, saidas bigint, resultado bigint)` (meses vazios com zero via `generate_series`; só `efetivado`); `gastos_por_categoria(p_ws, p_de, p_ate) returns table(categoria_id uuid, nome text, cor text, total bigint)` (sem categoria → "Sem categoria"); `orcamento_vs_realizado(p_ws uuid, p_mes date) returns table(categoria_id uuid, nome text, orcado bigint, realizado bigint, percentual numeric)` (`percentual` nulo quando `orcado = 0`).

- [ ] **Step 1: Teste que falha:** lançamentos em `2026-12-31` e `2027-01-01` em meses distintos; mês vazio retorna zeros; `percentual` nulo com orçado zero; pendentes fora do resumo.
- [ ] **Step 2:** FAIL → migração → PASS.
- [ ] **Step 3:** Invocar a skill `dataviz` antes dos gráficos. KPIs, barras entradas×saídas 12 meses, barras horizontais por categoria, progresso do orçamento (destaque acima de 100%), últimos 10 lançamentos; card A pagar/A receber (30 dias, `pendente`) só no tipo `empresa`.
- [ ] **Step 4: Verificar** em tema claro/escuro e largura de celular. **Step 5:** commit `feat: dashboard`.

### Task 11: Orçamento

**Files:** Create `src/features/orcamento/{queries.ts,actions.ts,grade-orcamento.tsx}`; `src/app/w/[id]/orcamento/page.tsx`.

**Interfaces — Consumes:** `parseValorBR`, `orcamento_vs_realizado`. **Produces:** `salvarOrcamento(ws, categoriaId, mes, valor: string): Promise<ActionResult<void>>` (upsert; vazio apaga); `copiarMesAnterior(ws, mes): Promise<ActionResult<{ copiados: number }>>` (não sobrescreve existentes).

- [ ] **Step 1:** Grade categorias de despesa × 6 meses, edição inline, realizado ao lado.
- [ ] **Step 2: Verificar:** editar, apagar, copiar mês anterior; dashboard reflete. **Step 3:** commit `feat: orçamento`.

### Task 12: Edições (pessoal / portfólio)

**Files:** Create `src/lib/edicao.ts`, `src/lib/edicao.test.ts`; Modify `src/app/page.tsx`, `src/app/login/page.tsx`, `.env.example` (`NEXT_PUBLIC_EDICAO=pessoal`).

**Interfaces — Produces:** `type Edicao = 'pessoal' | 'portfolio'`; `obterEdicao(valor?: string): Edicao` (padrão `'pessoal'` quando ausente/inválido); `recursos(e: Edicao): { demo: boolean; cadastroAberto: boolean }`.

- [ ] **Step 1: Testes que falham:** `obterEdicao(undefined)` → `'pessoal'`; `obterEdicao('xyz')` → `'pessoal'`; `recursos('pessoal')` → `{ demo: false, cadastroAberto: false }`; `recursos('portfolio')` → `{ demo: true, cadastroAberto: true }`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Na edição pessoal, `/` redireciona para `/login` (ou último workspace se autenticado) e o link "Criar conta" some do login; a Server Action de cadastro retorna `{ ok: false, erro: 'Cadastro desabilitado' }` quando `!cadastroAberto`.
- [ ] **Step 4:** lint/typecheck/test verdes. **Step 5:** commit `feat: edições pessoal e portfólio`.

### Task 13: Metas de poupança

**Files:** Create migração `metas`; `src/features/metas/{calcular-meta.ts,calcular-meta.test.ts,queries.ts,actions.ts,card-meta.tsx,form-aporte.tsx}`; `src/app/w/[id]/metas/page.tsx`; Modify `src/app/w/[id]/page.tsx` (card resumo); `tests/integracao/rls.test.ts` (incluir `metas`, `aportes_meta`).

**Interfaces — Produces:**
```ts
type SituacaoMeta = 'no_ritmo' | 'atrasada' | 'concluida' | 'vencida'
calcularMeta(i: { alvo: number; guardado: number; dataAlvo: string; hoje: string; sobraMedia: number }):
  { faltam: number; mesesRestantes: number; necessarioPorMes: number; sobraMedia: number; situacao: SituacaoMeta }
listarMetas(ws: string): Promise<(Meta & { guardado: number; calculo: ReturnType<typeof calcularMeta> })[]>
sobraMedia3Meses(ws: string, hoje: string): Promise<number>   // média de resultado dos 3 meses fechados via resumo_mensal
```
Actions: `criarMeta`, `editarMeta`, `excluirMeta`, `registrarAporte(ws, metaId, data, valor: string)` (valor negativo = retirada).

- [ ] **Step 1: Testes que falham (`calcular-meta.test.ts`):**
  - alvo 1.000.000, guardado 280.000, hoje `2026-10-15`, dataAlvo `2027-09-30` → `mesesRestantes 12`, `faltam 720000`, `necessarioPorMes 60000`.
  - mesma meta com `sobraMedia 45000` → `'atrasada'`; com `60000` → `'no_ritmo'`.
  - guardado ≥ alvo → `'concluida'`, `necessarioPorMes 0`.
  - dataAlvo no passado e guardado < alvo → `'vencida'`, `mesesRestantes 1`.
  - dataAlvo no mês atual → `mesesRestantes 1`. `necessarioPorMes` arredonda para cima ao centavo.
- [ ] **Step 2:** FAIL → implementar (aritmética de meses sobre `YYYY-MM`, sem `Date`) → PASS.
- [ ] **Step 3:** Migração (tabelas do spec, RLS `is_member`, FK `meta_id on delete cascade`); estender `rls.test.ts`; `npm run db:migrate`; `npm run test:integracao` → PASS.
- [ ] **Step 4:** Tela de metas (cards com barra de progresso, "R$ X/mês necessários · sua sobra média R$ Y", situação colorida) e card resumo no dashboard. Verificar no navegador.
- [ ] **Step 5:** commit `feat: metas de poupança`.

### Task 14: PWA e lançamento rápido

**Files:** Create `src/app/manifest.ts`, `public/icons/{icon-192.png,icon-512.png,maskable-512.png}`, `src/components/barra-inferior.tsx`, `src/features/lancamentos/{lancamento-rapido.tsx,categorias-frequentes.ts}`; Modify `src/app/w/[id]/layout.tsx`, `src/features/lancamentos/actions.ts`.

**Interfaces — Consumes:** `criarLancamento` (Task 8). **Produces:** `categoriasFrequentes(ws: string, hoje: string, limite = 6): Promise<Categoria[]>` (por contagem de lançamentos de saída nos últimos 60 dias, empate por nome); cookie `ultima_conta_<ws>` gravado por `criarLancamento`.

- [ ] **Step 1:** `manifest.ts`: `name 'Dashboard Financeiro'`, `short_name 'Finanças'`, `display 'standalone'`, `start_url '/'`, ícones acima. Ícones gerados (SVG simples → PNG).
- [ ] **Step 2:** Barra inferior visível só `< 768px` (Início, Lançamentos, +, Metas, Orientações); `+` abre sheet do lançamento rápido (shadcn `Sheet`, lado `bottom`).
- [ ] **Step 3:** Lançamento rápido: valor com `inputMode="decimal"` e foco automático, "saída" pré-selecionado, chips de `categoriasFrequentes` + "mais…", conta pré-selecionada pelo cookie, data hoje editável, descrição opcional; ao salvar, fecha e mostra toast.
- [ ] **Step 4: Verificar** com `resize_window` preset mobile: lançar um gasto em ≤ 3 toques após abrir o sheet; Lighthouse/Chrome reconhece o app como instalável (manifest válido). lint/typecheck/test verdes.
- [ ] **Step 4b (pendências herdadas da Task 10):** (1) corrigir `--font-sans: var(--font-sans)` auto-referente em `src/app/globals.css` (a fonte do app cai em serifa): apontar para a variável da fonte carregada em `layout.tsx` (ex.: Geist) e confirmar no navegador; (2) tema escuro alcançável: aplicar a classe `.dark` a partir de `prefers-color-scheme` (e `theme-color` no manifest/viewport), sem toggle manual na v1; verificar gráficos e tiles nos dois temas.
- [ ] **Step 5:** commit `feat: PWA e lançamento rápido`.

### Task 14b: Favorecido (campo, filtro e sugestões)

**Files:** Create migração `favorecido` (colunas `favorecido`, `favorecido_chave`, índice `(workspace_id, favorecido_chave, data)`; backfill: nenhum, colunas nulas); `src/features/favorecido/{normalizar.ts,normalizar.test.ts,servico.ts,queries.ts}`; Modify `src/db/schema.ts`, `src/features/lancamentos/{schemas.ts,servico.ts,queries.ts,form-lancamento.tsx,filtros-lancamentos.tsx,tabela-lancamentos.tsx}`, `src/features/lancamentos/lancamento-rapido.tsx` (campo opcional).

**Interfaces — Produces:** `normalizarFavorecido(nome: string): string` (chave); `listarFavorecidos(ws: string): Promise<{ chave: string; nome: string; total: number }[]>` (nome = grafia mais recente); filtro `favorecidoChave?: string` em `listarLancamentos` (Task 8); `criarLancamento`/`editarLancamento` aceitam `favorecido?: string` (grava nome aparado e chave; vazio → nulos).

- [ ] **Step 1: Testes que falham (`normalizar.test.ts`):** `'Jeová'`, `'jeova'`, `'  Senhor   Jeová '`, `'Sr. Jeová'`, `'seu Jeová'` → todos `'jeova'`; `'Dona Maria José'` → `'maria jose'`; `'João da Silva'` → `'joao da silva'`; `''` e `'senhor'` → `''`. Integração: lançamento com favorecido 'Jeová' é achado por filtro com chave de 'senhor jeova'; B não vê favorecidos de A; `listarFavorecidos` agrupa por chave e devolve a grafia mais recente.
- [ ] **Step 2:** FAIL → implementar → PASS; migração aplicada na dev; `npm run test:integracao` verde.
- [ ] **Step 3:** UI: campo "Para quem / De quem" no formulário (datalist/autocomplete com `listarFavorecidos`), coluna na tabela e filtro por favorecido.
- [ ] **Step 4:** lint/typecheck/test/build; commit `feat: favorecido nos lançamentos`.

### Task 15: Lançamento por voz

**Files:** Create `src/features/voz/{interpretar-fala.ts,interpretar-fala.test.ts,numeros-extenso.ts,numeros-extenso.test.ts,valor-por-extenso.ts,use-reconhecimento.ts,botao-voz.tsx,confirmacao-voz.tsx}`; Modify `src/app/w/[id]/page.tsx` (botão no topo), `src/features/lancamentos/lancamento-rapido.tsx` (aceitar valores iniciais; atalho de voz no sheet).

**Interfaces — Consumes:** `aplicarRegras` (Task 6), `criarLancamento` e cookie `ultima_conta_<ws>` (Tasks 8/14), `formatarBRL`. **Produces:**
```ts
type FalaInterpretada = { ok: true; valorCentavos: number; descricao: string; data: string; favorecido?: string } // valor com sinal: saída negativa; favorecido extraído de "para o/a <nome>" (saída) ou "de/do/da <nome>" (entrada), sem tratamento ("senhor Jeová" → "Jeová")
                      | { ok: false; motivo: 'vazio' | 'sem_valor' }
interpretarFala(texto: string, hoje: string): FalaInterpretada
extensoParaNumero(palavras: string): number | null        // "cinco mil e quinhentos" -> 5500
valorPorExtenso(centavos: number): string                  // 20000 -> "duzentos reais" (para a fala de confirmação)
useReconhecimento(): { suportado: boolean; ouvindo: boolean; parcial: string; iniciar(): void; parar(): void; final: string | null; erro: string | null }
```

- [ ] **Step 1: Testes que falham** (`hoje = '2026-10-15'`):
  - O reconhecimento de voz do Chrome costuma devolver nomes próprios em minúsculas: o `favorecido` extraído da fala deve sair com **capitalização de nome próprio** (cada palavra com inicial maiúscula, exceto `da|de|do|das|dos|e`), sem tratamento: `'200 reais para o senhor jeová'` → `favorecido: 'Jeová'`; `'recebi 350 reais da maria josé'` → `'Maria José'`; `'paguei 50 reais para joão da silva'` → `'João da Silva'`. (Evita que o título da exportação saia "Transações efetuadas | jeová".)
  - `'200 reais para o senhor Jeová'` → `{ ok: true, valorCentavos: -20000, descricao: 'Para o senhor Jeová', data: '2026-10-15', favorecido: 'Jeová' }`.
  - `'pagamento do boleto de 5 mil reais referente a financiamento da van Renault'` → `-500000`, descrição contém `'financiamento da van Renault'` e começa com maiúscula.
  - `'R$ 1.500,50 conta de luz'` → `-150050`, `'Conta de luz'`.
  - `'recebi 350 reais do João'` → `+35000`, descrição `'Do João'`, `favorecido: 'João'`; `'200 reais de gasolina'` → sem `favorecido`.
  - `'200 reais e 50 centavos padaria'` → `-20050`.
  - `'cinco mil e quinhentos de aluguel'` → `-550000`.
  - `'ontem paguei 80 reais de gasolina'` → `data: '2026-10-14'`; `'dia 20 paguei 50 reais'` → `data: '2026-09-20'`; `'dia 3 ...'` → `'2026-10-03'`; `'dia 29 de setembro paguei 100 reais para o senhor Jeová'` → `data: '2026-09-29'`, `-10000`, `favorecido: 'Jeová'`; `'dia 5 de outubro ...'` → `'2026-10-05'`; mês futuro sem ano (`'dia 10 de dezembro ...'` com hoje 2026-10-15) → `'2025-12-10'`.
  - `'para o senhor Jeová'` → `{ ok: false, motivo: 'sem_valor' }`; `'   '` → `{ ok: false, motivo: 'vazio' }`.
  - `extensoParaNumero`: `'duzentos'` → 200, `'mil e duzentos'` → 1200, `'dois mil e trinta'` → 2030, `'banana'` → null. `valorPorExtenso(20000)` → `'duzentos reais'`, `valorPorExtenso(150050)` → `'mil e quinhentos reais e cinquenta centavos'`.
- [ ] **Step 2:** FAIL → implementar (normalizar: minúsculas, sem acento para casar palavras-chave mas descrição preserva acentos; datas por aritmética de string, sem `Date` com fuso) → PASS.
- [ ] **Step 3:** `useReconhecimento` com `window.SpeechRecognition ?? window.webkitSpeechRecognition`, `lang 'pt-BR'`, `interimResults true`, `continuous false`; `suportado false` fora do navegador ou sem API. Erros `not-allowed` → mensagem "Permita o microfone nas configurações do navegador".
- [ ] **Step 4:** Invocar a skill `frontend-design` antes do visual (pedir confirmação ao usuário conforme CLAUDE.md). `BotaoVoz` no topo do dashboard (~120px, alto contraste, animação de pulso respeitando `prefers-reduced-motion`, rótulo "Toque e fale", `aria-label`); `ConfirmacaoVoz` em tela cheia: valor ≥ 40px com cor por sinal, descrição, favorecido ("Para: Jeová", editável), data, conta, categoria sugerida (`aplicarRegras`), botões "Está certo" e "Falar de novo" com ≥ 56px de altura, link "Corrigir" (abre lançamento rápido preenchido). Após salvar: `speechSynthesis.speak` com `'Anotado: ' + valorPorExtenso(|v|) + ' ' + descricao` em `pt-BR`. Sem suporte: botão "Use o Chrome para falar" abre lançamento rápido.
- [ ] **Step 5: Verificar** no navegador: com `resize_window` mobile, fluxo completo simulando o resultado do reconhecimento (injetar `final` via props/teste de componente, já que o navegador do agente não tem microfone); no celular real do usuário, as duas frases de exemplo dele. lint/typecheck/test verdes. Commit `feat: lançamento por voz`.

### Task 15b: Exportação de lista por favorecido e período (tela + voz)

**Files:** Create `src/features/exportacao/{relatorio.ts,relatorio.test.ts,periodos.ts,periodos.test.ts,render-png.ts,render-pdf.ts,compartilhar.ts,pagina-exportar.tsx,previa-relatorio.tsx}`; `src/features/voz/{interpretar-comando.ts,interpretar-comando.test.ts}`; página `src/app/w/[id]/exportar/page.tsx`; Modify `src/features/voz/{botao-voz.tsx,confirmacao-voz.tsx}`, `src/features/lancamentos/tabela-lancamentos.tsx` (botão Exportar com os filtros atuais), navegação. Dep: `jspdf`.

**Interfaces — Consumes:** `listarLancamentos` com filtro `favorecidoChave`, `listarFavorecidos`, `normalizarFavorecido` (Task 14b), `interpretarFala` e helpers de data/extenso (Task 15), `formatarBRL`. **Produces:**
```ts
type OpcoesRelatorio = { favorecido: string; de: string; ate: string; tipo: 'saidas' | 'entradas' | 'todas'; mostrarTotal: boolean; anotacoes: 'descricao' | 'branco' }
type Relatorio = { titulo: string; periodo: string; linhas: { data: string; anotacao: string; valor: string }[]; total?: string }
montarRelatorio(lancamentos: { data: string; descricao: string; valorCentavos: number }[], op: OpcoesRelatorio): Relatorio
type Comando =
  | { tipo: 'lancamento' }
  | { tipo: 'exportar'; favorecido: string; de: string; ate: string; filtroTipo: 'saidas' | 'entradas' | 'todas' }  // favorecido '' = todos
  | { tipo: 'exportar_incompleto'; falta: 'periodo' }
interpretarComando(texto: string, hoje: string): Comando
resolverPeriodo(texto: string, hoje: string): { de: string; ate: string } | null
sugerirFavorecidos(busca: string, existentes: { chave: string; nome: string }[], limite?: number): { chave: string; nome: string }[]
renderizarPng(r: Relatorio): Promise<Blob[]>   // até 25 linhas por imagem, largura 1080
renderizarPdf(r: Relatorio): Promise<Blob>
compartilharOuBaixar(arquivos: File[], titulo: string): Promise<void>   // navigator.share({ files }) quando suportado, senão download
```

- [ ] **Step 1: Testes que falham** (`hoje = '2026-10-08'`):
  - `montarRelatorio` com os 3 pagamentos da conversa de referência (29/09 R$ 100,00; 05/10 R$ 300,00; 08/10 R$ 300,00; saídas a 'Jeová'; `anotacoes: 'descricao'`; `mostrarTotal: false`) → `titulo 'Transações efetuadas | Jeová'`, `periodo '29/09/2026 a 08/10/2026'`, linhas em ordem de data crescente com `data 'dd/mm/aaaa'` e `valor 'R$ 100,00'`/`'R$ 300,00'` (sem sinal nas saídas) e **sem `total`**; com `mostrarTotal: true` → `total 'R$ 700,00'`; `anotacoes: 'branco'` → `anotacao ''`; `tipo: 'todas'` mantém o sinal (`-R$ 300,00`); lançamento fora do intervalo não entra (31/12 e 01/01 em intervalos que os separam); `favorecido: ''` → título `'Transações efetuadas | Todos'`.
  - `resolverPeriodo`: `'este mês'` → `{ de: '2026-10-01', ate: '2026-10-08' }`; `'mês passado'` → `{ de: '2026-09-01', ate: '2026-09-30' }`; `'últimos 15 dias'` → `{ de: '2026-09-23', ate: '2026-10-08' }`; `'semana passada'` (segunda a domingo anteriores) → `{ de: '2026-09-28', ate: '2026-10-04' }`; `'de 29 de setembro até 8 de outubro'` → `{ de: '2026-09-29', ate: '2026-10-08' }`; `'de 1 a 8 de outubro'` → `{ de: '2026-10-01', ate: '2026-10-08' }`; `'de 25 de dezembro a 5 de janeiro'` com hoje `2026-01-10` → `{ de: '2025-12-25', ate: '2026-01-05' }`; ano omitido com data futura → ano anterior; intervalo invertido (`'de 8 a 1 de outubro'`) é corrigido; sem período → `null`.
  - `interpretarComando`: `'exporte as transações para o senhor Jeová de 29 de setembro até 8 de outubro'` → `{ tipo: 'exportar', favorecido: 'Jeová', de: '2026-09-29', ate: '2026-10-08', filtroTipo: 'saidas' }`; `'manda a lista do Jeová deste mês'` → exportar com este mês; `'exportar o que recebi do João no mês passado'` → `filtroTipo: 'entradas'`, favorecido `'João'`; `'exporte tudo do mês passado'` → `favorecido: ''`; `'exporte para Jeová'` → `{ tipo: 'exportar_incompleto', falta: 'periodo' }`; `'200 reais para o senhor Jeová'` → `{ tipo: 'lancamento' }`.
  - `sugerirFavorecidos('jeova', [{ chave: 'jeova', nome: 'Jeová' }, { chave: 'jose', nome: 'José' }])` → Jeová primeiro; `'jeovah'` (distância 1) também sugere Jeová; nome sem parecido → `[]`.
- [ ] **Step 2:** FAIL → implementar (datas por aritmética de string; nomes de mês em PT-BR sem acento para casar; reutilizar os helpers da Task 15) → PASS.
- [ ] **Step 3:** Renderização. `renderizarPng`: canvas de 1080px de largura, título grande (≥ 48px), período abaixo, cabeçalho **Data | Anotações | Valor**, linhas com fonte ≥ 36px e zebra suave, contraste ≥ 7:1, valor alinhado à direita; Anotações com até 2 linhas e reticências; total só se `r.total`; mais de 25 linhas → várias imagens com rodapé "Parte 1/N". `renderizarPdf` com `jspdf`: A4 retrato, mesma estrutura, paginação automática, acentos preservados (`Jeová`, `Anotações`). Nada vai para servidor.
- [ ] **Step 4:** Tela `/w/[id]/exportar` (mobile-first, botões ≥ 56px): favorecido com autocomplete e opção "Todos", período com atalhos e dois campos de data, tipo (padrão saídas), opções "mostrar total" (desligada) e "anotações" (descrição ou em branco), prévia do relatório, botões **Compartilhar**, **Baixar PNG**, **Baixar PDF**; estado vazio "Nenhuma transação nesse período para <nome>". O botão "Exportar" da lista de lançamentos leva à tela com os filtros preenchidos.
- [ ] **Step 5:** Voz: o `BotaoVoz` passa o texto final por `interpretarComando`. `exportar` → action de servidor (com `exigirUsuario`) busca os lançamentos; a `ConfirmacaoVoz` (modo exportação) mostra o relatório pronto com "Compartilhar", "Baixar" e "Falar de novo", e fala "Encontrei três transações para Jeová, de 29 de setembro a 8 de outubro" (sem total); zero resultados → "Não encontrei transações nesse período"; favorecido inexistente → mostra e fala as sugestões de `sugerirFavorecidos`; `exportar_incompleto` → pergunta o período.
- [ ] **Step 6: Verificar:** no navegador (`resize_window` mobile), criar pelo formulário os 3 pagamentos da conversa para 'Jeová', gerar a lista e conferir visualmente o PNG (título, colunas, valores, sem soma) e abrir o PDF; testar o Compartilhar (no desktop cai no download); simular a fala `'exporte as transações para o senhor Jeová de 29 de setembro até 8 de outubro'` injetando o texto; no celular real do usuário, conferir o Compartilhar abrindo o WhatsApp e a fala real. lint/typecheck/test/build verdes. Commit `feat: exportação de lista por favorecido`.

### Task 16: Orientador por regras e biblioteca "Aprenda"

**Files:** Create migração `orientador`; `src/features/orientador/{tipos.ts,contexto.ts,motor.ts,motor.test.ts,regras/*.ts,regras/*.test.ts,conteudo/*.md,biblioteca.ts,biblioteca.test.ts,actions.ts,lista-alertas.tsx,card-alertas.tsx}`; páginas `src/app/w/[id]/orientacoes/page.tsx`, `src/app/w/[id]/orientacoes/[slug]/page.tsx`; Modify `src/app/w/[id]/page.tsx`, config (limites). Dev dep: `gray-matter`.

**Interfaces — Consumes:** `resumo_mensal`, `gastos_por_categoria`, `orcamento_vs_realizado` (Task 10), `listarMetas`/`calcularMeta` (Task 13). **Produces:**
```ts
type Severidade = 'critico' | 'atencao' | 'info' | 'positivo'
type Alerta = { regraId: string; chave: string; severidade: Severidade; titulo: string; texto: string; dicaId: string }
type ConfigOrientador = { limiteCategoriaPct: number; altaPct: number; cartaoPct: number }   // padrões 15, 30, 30
type ContextoFinanceiro = {
  hoje: string; diaDoMes: number; diasNoMes: number; rendaMes: number; saidasMes: number;
  categorias: { id: string; nome: string; gastoMes: number; mediaTresMeses: number }[];
  orcamentos: { categoriaId: string; nome: string; orcado: number; realizado: number }[];
  metas: { id: string; nome: string; situacao: SituacaoMeta; necessarioPorMes: number; sobraMedia: number }[];
  gastoCartaoMes: number; resultadosTresMeses: number[];
}
type Regra = (ctx: ContextoFinanceiro, cfg: ConfigOrientador) => Alerta[]
avaliar(ctx, cfg, dispensados: { regraId: string; chave: string; severidade: Severidade }[]): Alerta[]  // ordenado por severidade
montarContexto(ws: string, hoje: string): Promise<ContextoFinanceiro>
carregarBiblioteca(): Dica[]   // Dica = { id; titulo; tema: 'orcamento'|'guardar'|'dividas'|'investir'; resumo; corpo }
```
Valores monetários nos textos via `formatarBRL`. `chave` identifica a instância (ex.: id da categoria) para dispensar.

- [ ] **Step 1: Testes que falham (um arquivo por regra, ids e limiares do spec):**
  - `categoria-pct-renda`: renda 500.000, Alimentação 110.000, limite 15 → 1 alerta `atencao` com "22%" no texto; renda 0 → `[]`.
  - `orcamento-80`/`orcamento-100`: realizado 85% → `atencao`; 100% → `critico` (só o de 100%, não ambos).
  - `mes-negativo`: dia 10 de 30, saídas 200.000, renda 500.000 → projeção 600.000 → `critico`; projeção ≤ renda → `[]`.
  - `categoria-alta`: média 10.000, mês 14.100, altaPct 30 → alerta; média 0 → `[]`.
  - `meta-atrasada`, `sem-reserva` (meta "Reserva de emergência" existente → `[]`; "RESERVA" também casa), `sobra-consistente` (`[100, 50, 1]` → positivo; `[100, -1, 50]` → `[]`), `cartao-alto`.
  - `avaliar`: ordena critico > atencao > info > positivo; alerta dispensado com mesma severidade é filtrado, com severidade maior reaparece.
  - `biblioteca.test.ts`: todos os 13 ids do spec existem; todo `dicaId` usado pelas regras existe; frontmatter válido (tema ∈ conjunto).
- [ ] **Step 2:** FAIL → implementar regras e motor → PASS.
- [ ] **Step 3:** Escrever os 13 textos em `conteudo/` (150-400 palavras cada, PT-BR, práticos, sem taxas atuais; citar onde consultar dados vigentes, ex.: Tesouro Direto e Banco Central). Rodapé fixo "Conteúdo educativo; não é recomendação de investimento."
- [ ] **Step 4:** Migração (`config_orientador`, `alertas_dispensados`, RLS) + `montarContexto` + action `dispensarAlerta`; telas `/orientacoes`, `/orientacoes/[slug]`, card no dashboard (3 primeiros), limites em config. `npm run test:integracao` (RLS das novas tabelas) → PASS.
- [ ] **Step 5: Verificar** no navegador com dados que disparem ao menos 3 regras. Commit `feat: orientador financeiro por regras`.

### Task 17: Publicação pessoal

**Files:** Create `scripts/criar-usuario.ts` (script `criar-usuario`: lê e-mail/nome/senha de prompts no terminal, cria o usuário com `criarAuthInterno()` de `src/lib/auth.ts` (instância separada, com cadastro liberado e sem handler HTTP; o `disableSignUp` da instância pública vale também para `auth.api.signUpEmail`, por isso não dá para usar a pública; rodando via `tsx` fora do Next, o `import 'server-only'` precisa ser resolvido, ex.: `--conditions react-server` ou um stub como o dos testes de integração)), `scripts/adicionar-membro.ts` (script `adicionar-membro`: pede e-mail do dono do workspace, nome do workspace e e-mail do novo membro; insere em `workspace_members` com papel `membro`; erro claro se algum não existir; idempotente). Modify `src/lib/auth.ts` (cadastro por e-mail desabilitado quando `!recursos(obterEdicao()).cadastroAberto`); migração `papel_membro` (check de `papel` aceita `dono` e `membro`). Test `tests/integracao/membro.test.ts`: membro vê e grava no workspace do dono; dono não vê workspaces do membro.

- [ ] **Step 1:** Em um arquivo de env de produção (fora do git) com `DATABASE_URL_UNPOOLED` do owner da branch `main`: `npm run db:criar-role-app -- --arquivo <arquivo>` (gera `app_user` e a `DATABASE_URL` dele), depois `npm run db:migrate` na branch `main` do Neon `financeiro-pessoal`. A Vercel recebe a `DATABASE_URL` do `app_user`, nunca a do owner. Projeto Vercel `financeiro-pessoal` ligado ao repositório, env: `DATABASE_URL` (branch `main`, pooled), `BETTER_AUTH_SECRET` (novo, diferente do dev), `BETTER_AUTH_URL` (URL da Vercel), `NEXT_PUBLIC_EDICAO=pessoal` (preenchidas pelo usuário no painel).
- [ ] **Step 2:** Usuário roda `npm run criar-usuario` apontando para a branch `main` duas vezes: para si e para o pai (digita as senhas no terminal; Claude não digita senhas). Cada um faz login e cria seu workspace pessoal; depois o usuário roda `npm run adicionar-membro` para entrar como membro do workspace do pai.
- [ ] **Step 3: Verificar:** tentativa de cadastro com outro e-mail falha; login funciona no celular; app instala na tela inicial; lançamento rápido grava; no celular do pai, lançamento por voz grava e aparece no seletor de workspace do usuário como "Pai".
- [ ] **Step 4:** A URL pessoal não é publicada no README (fica só com o usuário). Commit se houver alterações.

### Task 18: Demo isolada (edição portfólio)

**Files:** Create migração `demo`; `src/features/demo/{actions.ts,banner-demo.tsx}`; `src/app/api/demo/limpar/route.ts`; `vercel.json` (cron `0 6 * * *`); `src/app/page.tsx` (landing).

Pré-requisito: usuário cria o projeto Neon `financeiro-portfolio`; `npm run db:criar-role-app -- --arquivo <env do portfólio>` antes de `db:migrate`; migrações aplicadas na branch `main`; a Vercel recebe a `DATABASE_URL` do `app_user` (nunca a do owner); projeto Vercel `financeiro-portfolio` com `NEXT_PUBLIC_EDICAO=portfolio`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRON_SECRET`.

**Interfaces — Produces:** SQL `semear_demo() returns uuid` — para `usuario_atual()` cria "Família Silva" (pessoal) e "Padaria Bom Pão" (empresa), 2 contas cada, 12 meses retroativos de lançamentos determinísticos (salário/vendas, contas fixas, variáveis), orçamentos do mês atual, 4 regras de categoria, 2 metas com aportes (uma "Reserva de emergência" atrasada) e, na Padaria, 6 pendentes nos próximos 30 dias; retorna id do workspace pessoal. Action `entrarComoDemo(): Promise<never>` (redirect).

- [ ] **Step 1:** Habilitar o plugin anônimo do Better Auth (gera coluna de anônimo na tabela `user`; rodar `db:generate`/`db:migrate`). Migração `semear_demo` (`security definer`; recusa se o usuário de `usuario_atual()` não for anônimo na tabela `user` ou se já tiver workspace).
- [ ] **Step 2:** Botão e action só existem quando `recursos(obterEdicao()).demo` (Task 12); na edição pessoal a action retorna erro. `entrarComoDemo`: login anônimo do Better Auth (API do servidor, conforme doc) → `comUsuario(id, tx => tx.execute(sql\`select semear_demo()\`))` → redirect `/w/[id]`. Banner "Você está na demo — os dados somem em 24h" para usuário anônimo.
- [ ] **Step 3:** Rota de limpeza: exige `Authorization: Bearer ${CRON_SECRET}` (senão 401); `delete from "user" where <anônimo> and created_at < now() - interval '24 hours'` (cascade apaga workspaces e dados); retorna `{ removidos: n }`. Teste de integração: usuário anônimo antigo é removido junto com seus workspaces; usuário normal permanece.
- [ ] **Step 4: Verificar:** duas janelas anônimas entram na demo e não veem dados uma da outra; `curl` sem segredo → 401; com segredo → 200.
- [ ] **Step 5:** commit `feat: demo isolada`.

### Task 19: E2E, README e publicação do portfólio

**Files:** Create `playwright.config.ts`, `e2e/demo.spec.ts`, `e2e/importacao.spec.ts`, `README.md`, `docs/demo.gif`.

- [ ] **Step 1:** `demo.spec.ts`: landing → "Entrar como demo" → vê "Saldo atual" → seleciona "Padaria Bom Pão" → vê card "A pagar".
- [ ] **Step 2:** `importacao.spec.ts`: demo → Importar → upload `nubank.ofx` → prévia com N linhas → confirmar → lançamento aparece em Lançamentos → Desfazer → some.
- [ ] **Step 3:** `npx playwright test` contra `npm run build && npm start` → PASS.
- [ ] **Step 4:** README estudo de caso: problema, decisões (RLS, centavos, dedupe por FITID/hash, demo isolada), como rodar, prints, GIF, link Vercel.
- [ ] **Step 4b (pendência da Task 15):** investigar e corrigir a rolagem horizontal de ~8px observada a 375px no painel do workspace (`scrollWidth` 379 vs `innerWidth` 371), que persiste com o botão de voz oculto, então vem de outro elemento; achar o elemento que excede com JS (`[...document.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > innerWidth)`), corrigir e adicionar um teste Playwright mobile (375px) de "sem overflow horizontal" nas páginas principais.
- [ ] **Step 5:** Deploy de produção; checar demo no celular. Commit `docs: README e e2e`.

## Verificação end-to-end

- `npm run lint && npm run typecheck && npm test` verde no CI.
- `npm run test:integracao` verde (RLS, importação, dashboard).
- `npx playwright test` verde.
- URL da Vercel: botão demo funciona em janela anônima no desktop e no celular.
