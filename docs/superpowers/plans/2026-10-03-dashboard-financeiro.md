# Dashboard Financeiro — Implementation Plan

> Revisão 2 (2026-10-03): Tasks 12-16 adicionadas (edições, metas, PWA, orientador, publicação pessoal); demo e E2E renumeradas para 17-18.
> Revisão 3 (2026-10-05): Supabase → Neon + Better Auth + Drizzle. Tasks 3, 7, 16 e 17 reescritas; nas demais, "migração" = arquivo SQL em `db/migrations/` criado com `npx drizzle-kit generate --custom --name <nome>` e aplicado com `npm run db:migrate`; chamadas a funções SQL usam `tx.execute(sql\`select ...\`)` dentro de `comUsuario`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a v1 do dashboard financeiro (Pessoal/Empresa, importação CSV/OFX, orçamento vs realizado, demo isolada) publicada na Vercel.

**Architecture:** Next.js App Router com Server Actions; Neon Postgres com RLS por workspace (usuário informado por `set_config` em cada transação); Better Auth para login; agregações e importação atômica em funções SQL; lógica de parsing em funções puras testadas com Vitest.

**Tech Stack:** Next.js + TypeScript, Tailwind, shadcn/ui, Recharts, Zod, Drizzle ORM + drizzle-kit, @neondatabase/serverless (Pool/WebSocket), Better Auth, next-intl, Papaparse, Vitest, Playwright, GitHub Actions, Vercel.

**Docs obrigatórias antes de codar:** Better Auth (instalação Next.js, adaptador Drizzle, `emailAndPassword` com bloqueio de cadastro, plugin anônimo) e Drizzle + Neon (`drizzle-orm/neon-serverless`). Ler a documentação oficial atual; não confiar em memória. Next 16: ver `node_modules/next/dist/docs/` (AGENTS.md).

**Spec:** `docs/superpowers/specs/2026-10-03-dashboard-financeiro-design.md` (seção acima neste arquivo).

## Pré-requisitos manuais (feitos pelo usuário)

1. Criar conta no Neon (neon.com) e o projeto `financeiro-pessoal` (região mais próxima disponível, ex.: AWS São Paulo se houver) com uma branch `dev`. O projeto `financeiro-portfolio` só na Task 17.
2. ~~Criar repositório público no GitHub~~ (feito).
3. Preencher `.env.local` (nunca commitado): `DATABASE_URL` (connection string da branch `dev`, versão **pooled**), `BETTER_AUTH_SECRET` (gerar com `npx @better-auth/cli secret` ou 32+ bytes aleatórios), `BETTER_AUTH_URL=http://localhost:3000`, `NEXT_PUBLIC_EDICAO=pessoal`, `CRON_SECRET`.

Pasta do projeto: `D:\Portfolio\dashboard-financeiro` (mover a sessão para lá com `change_directory` antes da Task 1).

**Execução:** Native (superpowers:executing-plans). Tasks 1-2 concluídas (commits da01f89, df04c1f).

## Global Constraints

- Dinheiro sempre em centavos inteiros (`number` no TS, `bigint` no Postgres); nunca float para valores.
- Datas de lançamento como string `YYYY-MM-DD` / tipo `date`; nunca converter via `new Date()` com fuso.
- Todo texto de UI vem de `messages/pt-BR.json` via next-intl.
- Server Actions retornam `ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string; campos?: Record<string, string> }`.
- Toda leitura/escrita de tabela de domínio passa por `comUsuario(userId, fn)` (Task 3). Acesso fora dele só nas tabelas do Better Auth, em `src/app/api/demo/limpar/route.ts` e nos helpers de teste.
- Banco só no servidor (`import 'server-only'` em `src/db/*`).
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

**Files:** Create `drizzle.config.ts`, `src/db/{cliente.ts,schema.ts,auth-schema.ts,com-usuario.ts}`, `db/migrations/*` (gerados), migrações customizadas `db/migrations/*_rls.sql`, `*_funcoes_workspace.sql`; Test `tests/integracao/rls.test.ts`, helper `tests/integracao/usuarios.ts` (insere/apaga linhas em `user` diretamente). Scripts `db:generate` (`drizzle-kit generate`), `db:migrate` (`drizzle-kit migrate`). Deps: `drizzle-orm @neondatabase/serverless ws better-auth server-only`; dev: `drizzle-kit @types/ws dotenv`. **Remover** `@supabase/ssr @supabase/supabase-js` (instalados na Task 1) e trocar as variáveis do `.env.example` pelas da seção de pré-requisitos.

**Interfaces — Produces:**
```ts
// src/db/cliente.ts — Pool WebSocket (neonConfig.webSocketConstructor = ws em Node)
export const db: NeonDatabase<typeof schema>
// src/db/com-usuario.ts
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
export async function comUsuario<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T>
// abre db.transaction, executa sql`select set_config('app.usuario_id', ${userId}, true)`, depois fn(tx)
```
SQL: `usuario_atual() returns text`; `is_member(ws uuid) returns boolean`; `criar_workspace(p_nome text, p_tipo text) returns uuid` (insere workspace com `criado_por = usuario_atual()`, membro `dono` e categorias padrão do tipo; erro se `usuario_atual()` for nulo). Tabelas do Better Auth geradas com `npx @better-auth/cli generate` para `src/db/auth-schema.ts` (conferir comando na doc atual).

Categorias padrão — pessoal: Salário, Outras receitas, Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Outros. Empresa: Vendas, Serviços, Outras receitas, Fornecedores, Folha, Impostos, Aluguel, Marketing, Outros.

- [ ] **Step 1: Teste que falha** (`rls.test.ts`, usuários A e B inseridos em `user` pelo helper e apagados no `afterAll`):
  - `comUsuario(A, tx => tx.execute(sql\`select criar_workspace('Casa', 'pessoal')\`))` retorna id; A insere conta e lançamento.
  - `comUsuario(B, tx => tx.select().from(lancamentos))` → `[]`.
  - `comUsuario(B, tx => tx.insert(lancamentos).values({ workspaceId: wsA, ... }))` → rejeita (violação de política).
  - `comUsuario(B, ...)` select em `workspaces` por `wsA` → `[]`.
  - `db.select().from(lancamentos)` **sem** `comUsuario` → `[]` (falha fechado).
  - A vê 9 categorias padrão.
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
- [ ] **Step 5:** commit `feat: PWA e lançamento rápido`.

### Task 15: Orientador por regras e biblioteca "Aprenda"

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

### Task 16: Publicação pessoal

**Files:** Create `scripts/criar-usuario.ts` (script `criar-usuario`: lê e-mail/nome/senha de prompts no terminal, cria o usuário pela API do servidor do Better Auth ignorando o bloqueio de cadastro, conforme doc atual). Modify `src/lib/auth.ts` (cadastro por e-mail desabilitado quando `!recursos(obterEdicao()).cadastroAberto`).

- [ ] **Step 1:** `npm run db:migrate` na branch `main` do Neon `financeiro-pessoal`. Projeto Vercel `financeiro-pessoal` ligado ao repositório, env: `DATABASE_URL` (branch `main`, pooled), `BETTER_AUTH_SECRET` (novo, diferente do dev), `BETTER_AUTH_URL` (URL da Vercel), `NEXT_PUBLIC_EDICAO=pessoal` (preenchidas pelo usuário no painel).
- [ ] **Step 2:** Usuário roda `npm run criar-usuario` apontando para a branch `main` e digita a própria senha no terminal (Claude não digita senhas).
- [ ] **Step 3: Verificar:** tentativa de cadastro com outro e-mail falha; login funciona no celular; app instala na tela inicial; lançamento rápido grava.
- [ ] **Step 4:** A URL pessoal não é publicada no README (fica só com o usuário). Commit se houver alterações.

### Task 17: Demo isolada (edição portfólio)

**Files:** Create migração `demo`; `src/features/demo/{actions.ts,banner-demo.tsx}`; `src/app/api/demo/limpar/route.ts`; `vercel.json` (cron `0 6 * * *`); `src/app/page.tsx` (landing).

Pré-requisito: usuário cria o projeto Neon `financeiro-portfolio`; migrações aplicadas na branch `main`; projeto Vercel `financeiro-portfolio` com `NEXT_PUBLIC_EDICAO=portfolio`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRON_SECRET`.

**Interfaces — Produces:** SQL `semear_demo() returns uuid` — para `usuario_atual()` cria "Família Silva" (pessoal) e "Padaria Bom Pão" (empresa), 2 contas cada, 12 meses retroativos de lançamentos determinísticos (salário/vendas, contas fixas, variáveis), orçamentos do mês atual, 4 regras de categoria, 2 metas com aportes (uma "Reserva de emergência" atrasada) e, na Padaria, 6 pendentes nos próximos 30 dias; retorna id do workspace pessoal. Action `entrarComoDemo(): Promise<never>` (redirect).

- [ ] **Step 1:** Habilitar o plugin anônimo do Better Auth (gera coluna de anônimo na tabela `user`; rodar `db:generate`/`db:migrate`). Migração `semear_demo` (`security definer`; recusa se o usuário de `usuario_atual()` não for anônimo na tabela `user` ou se já tiver workspace).
- [ ] **Step 2:** Botão e action só existem quando `recursos(obterEdicao()).demo` (Task 12); na edição pessoal a action retorna erro. `entrarComoDemo`: login anônimo do Better Auth (API do servidor, conforme doc) → `comUsuario(id, tx => tx.execute(sql\`select semear_demo()\`))` → redirect `/w/[id]`. Banner "Você está na demo — os dados somem em 24h" para usuário anônimo.
- [ ] **Step 3:** Rota de limpeza: exige `Authorization: Bearer ${CRON_SECRET}` (senão 401); `delete from "user" where <anônimo> and created_at < now() - interval '24 hours'` (cascade apaga workspaces e dados); retorna `{ removidos: n }`. Teste de integração: usuário anônimo antigo é removido junto com seus workspaces; usuário normal permanece.
- [ ] **Step 4: Verificar:** duas janelas anônimas entram na demo e não veem dados uma da outra; `curl` sem segredo → 401; com segredo → 200.
- [ ] **Step 5:** commit `feat: demo isolada`.

### Task 18: E2E, README e publicação do portfólio

**Files:** Create `playwright.config.ts`, `e2e/demo.spec.ts`, `e2e/importacao.spec.ts`, `README.md`, `docs/demo.gif`.

- [ ] **Step 1:** `demo.spec.ts`: landing → "Entrar como demo" → vê "Saldo atual" → seleciona "Padaria Bom Pão" → vê card "A pagar".
- [ ] **Step 2:** `importacao.spec.ts`: demo → Importar → upload `nubank.ofx` → prévia com N linhas → confirmar → lançamento aparece em Lançamentos → Desfazer → some.
- [ ] **Step 3:** `npx playwright test` contra `npm run build && npm start` → PASS.
- [ ] **Step 4:** README estudo de caso: problema, decisões (RLS, centavos, dedupe por FITID/hash, demo isolada), como rodar, prints, GIF, link Vercel.
- [ ] **Step 5:** Deploy de produção; checar demo no celular. Commit `docs: README e e2e`.

## Verificação end-to-end

- `npm run lint && npm run typecheck && npm test` verde no CI.
- `npm run test:integracao` verde (RLS, importação, dashboard).
- `npx playwright test` verde.
- URL da Vercel: botão demo funciona em janela anônima no desktop e no celular.
