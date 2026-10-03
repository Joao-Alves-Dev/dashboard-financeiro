# Dashboard Financeiro — Implementation Plan

> Será salvo como `docs/superpowers/plans/2026-10-03-dashboard-financeiro.md`.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a v1 do dashboard financeiro (Pessoal/Empresa, importação CSV/OFX, orçamento vs realizado, demo isolada) publicada na Vercel.

**Architecture:** Next.js App Router com Server Actions; Supabase Postgres com RLS por workspace; agregações e importação atômica em funções SQL; lógica de parsing em funções puras testadas com Vitest.

**Tech Stack:** Next.js + TypeScript, Tailwind, shadcn/ui, Recharts, Zod, @supabase/ssr, next-intl, Papaparse, Vitest, Playwright, Supabase CLI, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-03-dashboard-financeiro-design.md` (seção acima neste arquivo).

## Pré-requisitos manuais (feitos pelo usuário)

1. Criar nova organização no Supabase e um projeto nela (região São Paulo); habilitar **Anonymous sign-ins** em Auth > Providers.
2. Criar repositório público no GitHub `dashboard-financeiro`.
3. Preencher `.env.local` (nunca commitado): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

Pasta do projeto: `D:\Portfolio\dashboard-financeiro` (mover a sessão para lá com `change_directory` antes da Task 1).

**Execução escolhida:** Native (superpowers:executing-plans) + revisão final independente. Primeiro passo após aprovação: mover sessão, salvar spec e plano em `docs/superpowers/`, aguardar pré-requisitos manuais (Supabase/GitHub) e iniciar Task 1.

## Global Constraints

- Dinheiro sempre em centavos inteiros (`number` no TS, `bigint` no Postgres); nunca float para valores.
- Datas de lançamento como string `YYYY-MM-DD` / tipo `date`; nunca converter via `new Date()` com fuso.
- Todo texto de UI vem de `messages/pt-BR.json` via next-intl.
- Server Actions retornam `ActionResult<T> = { ok: true; data: T } | { ok: false; erro: string; campos?: Record<string, string> }`.
- `service_role` usada apenas em `src/app/api/demo/limpar/route.ts` e nos testes de integração.
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

### Task 3: Esquema, RLS e teste de isolamento

**Files:** Create `supabase/migrations/0001_esquema.sql`, `0002_rls.sql`, `0003_funcoes_workspace.sql`; Test `tests/integracao/rls.test.ts`, helper `tests/integracao/usuarios.ts` (cria/apaga usuários com service role).

**Interfaces — Produces:** tabelas/colunas exatamente como no spec; `is_member(ws uuid) returns boolean`; `criar_workspace(p_nome text, p_tipo text) returns uuid` (insere workspace, membro `dono` e categorias padrão do tipo).

Categorias padrão — pessoal: Salário, Outras receitas, Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Outros. Empresa: Vendas, Serviços, Outras receitas, Fornecedores, Folha, Impostos, Aluguel, Marketing, Outros.

- [ ] **Step 1: Teste que falha:**
  - A cria workspace via `rpc('criar_workspace')`, insere conta e lançamento.
  - `B.from('lancamentos').select()` → `[]`.
  - `B.from('lancamentos').insert({ workspace_id: wsA, ... })` → erro.
  - `B.from('workspaces').select().eq('id', wsA)` → `[]`.
  - A vê 9 categorias padrão.
- [ ] **Step 2:** `supabase link` + `supabase db push` (vazio); rodar → FAIL.
- [ ] **Step 3:** Migrações. `is_member`: `security definer`, `stable`, `set search_path = public`. Policies `for all using (is_member(workspace_id)) with check (is_member(workspace_id))` em todas as tabelas com `workspace_id`; `workspaces`: select por `is_member(id)`, criação só via `criar_workspace`. Índices: `lancamentos(workspace_id, data)`, unique `(conta_id, id_externo)`.
- [ ] **Step 4:** `supabase db push`; `npm run test:integracao` → PASS.
- [ ] **Step 5:** commit `feat: esquema, RLS e criação de workspace`.

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

**Files:** Create `src/lib/supabase/server.ts`, `client.ts`, `src/middleware.ts`, `src/lib/action-result.ts`, `src/app/login/{page.tsx,actions.ts}`, `src/app/novo/{page.tsx,actions.ts}`, `src/app/w/[id]/layout.tsx`, `src/features/workspaces/{queries.ts,seletor-workspace.tsx}`.

**Interfaces — Produces:** `criarClienteServidor(): Promise<SupabaseClient>`; `obterWorkspace(id: string): Promise<Workspace>` (chama `notFound()` quando RLS não retorna linha); `listarWorkspaces(): Promise<Workspace[]>`; type `ActionResult<T>`.

- [ ] **Step 1:** Login/logout por e-mail e senha; middleware renova sessão e redireciona não autenticados de `/w/*` e `/novo` para `/login`.
- [ ] **Step 2:** `/novo` (Zod: nome 2-60 chars, tipo `pessoal|empresa`) → `rpc('criar_workspace')` → redirect `/w/[id]`.
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

**Files:** Create `supabase/migrations/0004_importacao.sql`; `src/features/importacao/{actions.ts,fluxo-importacao.tsx,previa.tsx,historico.tsx}`; `src/app/w/[id]/importar/page.tsx`; Test `tests/integracao/importacao.test.ts`.

**Interfaces — Consumes:** `decodificarArquivo`, `parseOfx`, `parseCsv`, `detectarColunasCsv`, `atribuirIdsExternos`, `aplicarRegras`. **Produces:** SQL `importar_lancamentos(p_ws uuid, p_conta uuid, p_arquivo text, p_formato text, p_linhas jsonb) returns table(importacao_id uuid, inseridos int, ignorados int)`; `desfazer_importacao(p_id uuid) returns void`; actions `previaImportacao(fd: FormData): Promise<ActionResult<{ linhas: (LinhaImportada & { idExterno: string; categoriaId: string | null; duplicado: boolean })[]; erros: ErroLinha[]; colunasCsv?: string[] }>>` e `confirmarImportacao(ws, contaId, arquivo, formato, linhas): Promise<ActionResult<{ inseridos: number; ignorados: number }>>`.

- [ ] **Step 1: Teste de integração que falha:** importar 3 linhas → `inseridos 3`; reimportar → `inseridos 0, ignorados 3`; `desfazer_importacao` remove as 3; usuário de outro workspace recebe erro.
- [ ] **Step 2:** FAIL → migração (`security invoker`, `on conflict (conta_id, id_externo) do nothing`) → PASS.
- [ ] **Step 3:** UI: upload (máx. 2 MB, `.ofx`/`.csv`); mapeamento CSV salvo em `contas.mapeamento_csv` e pré-preenchido depois; prévia com duplicados acinzentados e erros listados; confirmar; histórico com "Desfazer".
- [ ] **Step 4: Verificar** no navegador com as fixtures das Tasks 4 e 5.
- [ ] **Step 5:** commit `feat: importação de extratos`.

### Task 10: Dashboard

**Files:** Create `supabase/migrations/0005_dashboard.sql`; `src/features/dashboard/{queries.ts,kpis.tsx,grafico-mensal.tsx,grafico-categorias.tsx,orcamento-resumo.tsx,a-pagar-receber.tsx}`; `src/app/w/[id]/page.tsx`; Test `tests/integracao/dashboard.test.ts`.

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

### Task 12: Demo isolada

**Files:** Create `supabase/migrations/0006_demo.sql`; `src/features/demo/{actions.ts,banner-demo.tsx}`; `src/app/api/demo/limpar/route.ts`; `vercel.json` (cron `0 6 * * *`); `src/app/page.tsx` (landing).

**Interfaces — Produces:** SQL `semear_demo() returns uuid` — para `auth.uid()` cria "Família Silva" (pessoal) e "Padaria Bom Pão" (empresa), 2 contas cada, 12 meses retroativos de lançamentos determinísticos (salário/vendas, contas fixas, variáveis), orçamentos do mês atual, 4 regras de categoria e, na Padaria, 6 pendentes nos próximos 30 dias; retorna id do workspace pessoal. Action `entrarComoDemo(): Promise<never>` (redirect).

- [ ] **Step 1:** Migração `semear_demo` (`security definer`; recusa se `auth.jwt()->>'is_anonymous'` não for `'true'` ou se o usuário já tiver workspace).
- [ ] **Step 2:** `entrarComoDemo`: `signInAnonymously()` → `rpc('semear_demo')` → redirect `/w/[id]`. Banner "Você está na demo — os dados somem em 24h" para usuário anônimo.
- [ ] **Step 3:** Rota de limpeza: exige `Authorization: Bearer ${CRON_SECRET}` (senão 401); via `auth.admin.listUsers` apaga anônimos com `created_at` há mais de 24h (`auth.admin.deleteUser`); retorna `{ removidos: n }`.
- [ ] **Step 4: Verificar:** duas janelas anônimas entram na demo e não veem dados uma da outra; `curl` sem segredo → 401; com segredo → 200.
- [ ] **Step 5:** commit `feat: demo isolada`.

### Task 13: E2E, README e publicação final

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
