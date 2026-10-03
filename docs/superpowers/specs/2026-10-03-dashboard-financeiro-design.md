# Dashboard Financeiro — Spec de Design (v1)

> Será salvo no projeto como `docs/superpowers/specs/2026-10-03-dashboard-financeiro-design.md` ao sair do modo de planejamento.

## Contexto

Projeto 3 de 4 do portfólio definido na sessão "Segunda fonte de renda" (objetivo: segunda renda via freela em sistemas internos para pequenas empresas). Portfólio: Controle de estoque (existente), Gerador de cartão da farmácia (existente), **Dashboard financeiro (este)**, App de delivery (próximo).

Critério de sucesso: app publicado, demo acessível em um clique, README em formato de estudo de caso, sem cara de tutorial — diferenciais reais (importação de extrato, orçamento vs realizado, modo Pessoal/Empresa).

Restrições: 5-8h/semana, ~3 semanas para a v1. Supabase em **nova organização** (a atual está no limite de 2 projetos). Deploy na Vercel.

## Escopo por fase

- **v1 (este spec):** workspaces Pessoal/Empresa, contas, categorias, lançamentos (CRUD), importação CSV/OFX com prévia/dedupe/desfazer, regras de categorização, orçamento vs realizado, dashboard, demo isolada.
- **v2 (fora):** projeção de caixa, lançamentos recorrentes.
- **v3 (fora):** multiusuário com papéis e convites (esquema já preparado via `workspace_members`).
- **Fora de tudo:** Open Finance/integração bancária, multi-moeda.

Idioma: PT-BR, BRL; textos centralizados em `messages/pt-BR.json` (next-intl) para i18n futura.

## Arquitetura

Next.js (App Router, TypeScript) + Server Actions + Supabase (Postgres, Auth, RLS). Autorização no banco via RLS; agregações em funções SQL; parsing de importação no servidor.

Stack: Tailwind, shadcn/ui, Recharts, Zod, `@supabase/ssr`, `next-intl`, Papaparse; parser OFX próprio. Migrações em `supabase/migrations/` aplicadas com Supabase CLI (`supabase db push`) no projeto remoto (sem Docker).

## Modelo de dados

| Tabela | Campos principais |
|---|---|
| `workspaces` | id, nome, tipo (`pessoal`/`empresa`), criado_por, criado_em |
| `workspace_members` | workspace_id, user_id, papel (`dono` na v1) — PK composta |
| `contas` | id, workspace_id, nome, tipo (`corrente`/`cartao`/`dinheiro`), saldo_inicial_centavos, mapeamento_csv (jsonb, opcional) |
| `categorias` | id, workspace_id, nome, natureza (`receita`/`despesa`), cor |
| `lancamentos` | id, workspace_id, conta_id, categoria_id (nullable), data, descricao, valor_centavos (bigint, + entrada / − saída), status (`efetivado`/`pendente`), id_externo, importacao_id (nullable) |
| `regras_categoria` | id, workspace_id, padrao (texto, match case-insensitive "contém"), categoria_id, prioridade |
| `orcamentos` | workspace_id, categoria_id, mes (date, dia 1), valor_centavos — único por (categoria, mes) |
| `importacoes` | id, workspace_id, conta_id, arquivo_nome, formato (`ofx`/`csv`), qtd_lancamentos, criado_em |

- Dinheiro sempre em centavos inteiros.
- Unique `(conta_id, id_externo)`: OFX usa FITID; CSV usa hash de (data, valor, descrição, índice de ocorrência da linha idêntica).
- Lançamentos manuais têm `id_externo` nulo (Postgres permite múltiplos nulos no unique).
- Saldo atual de uma conta = `saldo_inicial_centavos` + soma dos lançamentos `efetivado`.
- Modo Empresa: `pendente` com data futura = conta a pagar/receber.
- FKs para `auth.users` e para `workspaces` com `on delete cascade` (a limpeza da demo depende disso).
- Categorias padrão criadas por função ao criar workspace (conjuntos diferentes para pessoal e empresa).

**RLS:** função `is_member(ws uuid)` (security definer, `stable`); todas as tabelas com policies `select/insert/update/delete using is_member(workspace_id)`. `service_role` só no endpoint de limpeza da demo.

**Funções SQL:** `resumo_mensal(ws, de, ate)`, `gastos_por_categoria(ws, de, ate)`, `orcamento_vs_realizado(ws, mes)`, `importar_lancamentos(ws, conta, arquivo, formato, linhas jsonb)` (transação única, `on conflict do nothing`, retorna inseridos/ignorados), `desfazer_importacao(id)`, `criar_workspace(nome, tipo)`, `semear_demo()`.

## Telas e fluxos

- `/` landing com "Entrar como demo" + login.
- `/login` e-mail/senha.
- `/novo` criar workspace.
- `/w/[id]` dashboard: KPIs (saldo atual, entradas do mês, saídas do mês, resultado), barras entradas×saídas 12 meses, gastos por categoria (barras horizontais), orçamento vs realizado (barras de progresso), últimos lançamentos; no tipo Empresa, card "A pagar / A receber — 30 dias".
- `/w/[id]/lancamentos` tabela filtrável, CRUD, categorizar em lote.
- `/w/[id]/importar` conta → upload → detecção de formato → (CSV: mapeamento de colunas, salvo na conta) → prévia (categoria sugerida, duplicados marcados, linhas inválidas com motivo) → confirmar; histórico com "desfazer".
- `/w/[id]/orcamento` grade categoria × mês editável, "copiar mês anterior".
- `/w/[id]/config` contas, categorias, regras.
- Seletor de workspace no cabeçalho (alternância Pessoal/Empresa).

**Demo isolada:** botão → `signInAnonymously` → `semear_demo()` cria para o usuário "Família Silva" (pessoal) e "Padaria Bom Pão" (empresa) com 12 meses de dados fictícios → redireciona ao dashboard. Vercel Cron diário em `/api/demo/limpar` (protegido por `CRON_SECRET`) apaga usuários anônimos com mais de 24h (cascade nos dados).

## Organização do código

```
src/app/                   rotas (finas)
src/lib/supabase/          server.ts, client.ts, middleware
src/lib/money.ts           parse "1.234,56" -> centavos; formatar BRL
src/features/importacao/   parse-ofx.ts, parse-csv.ts, id-externo.ts, aplicar-regras.ts, actions.ts, componentes
src/features/lancamentos/  queries.ts, actions.ts, componentes
src/features/orcamento/
src/features/dashboard/    queries (rpc) + gráficos
src/features/demo/         action de entrada, rota de limpeza
supabase/migrations/       esquema, RLS, funções, seed demo
messages/pt-BR.json
```
Parsers, money, id-externo e regras são funções puras sem dependência de Supabase.

## Tratamento de erros

- Server Actions retornam `{ ok: true, data } | { ok: false, erro }`; erros Zod mapeados para campos.
- Importação: linha inválida não aborta o arquivo — aparece na prévia com motivo e é excluída; gravação atômica via `importar_lancamentos`.
- Workspace inacessível (RLS) → 404.
- OFX: detectar encoding (Latin-1/UTF-8) e cabeçalho SGML (1.x) ou XML (2.x).

## Testes

- Vitest (TDD): parse-ofx (fixtures anonimizadas estilo Itaú, Nubank, Inter), parse-csv (`;`, `1.234,56`, `dd/mm/aaaa`), money, id-externo, aplicar-regras.
- Teste de isolamento RLS: script com dois usuários; B não lê nem grava dados do workspace de A.
- Playwright: (1) demo → dashboard → troca para Empresa; (2) importar OFX → prévia → confirmar → dashboard → desfazer.
- GitHub Actions: lint, typecheck, Vitest em todo push.

## Entrega

Repositório público no GitHub; README como estudo de caso (problema, decisões: RLS, centavos, dedupe, demo isolada; prints; GIF; link da demo); deploy Vercel.

## Cronograma (~6h/semana)

| Semana | Entrega |
|---|---|
| 1 | Setup, esquema + RLS + teste de isolamento, auth, workspace, CRUD de lançamentos/contas, primeiro deploy |
| 2 | Parsers OFX/CSV (TDD), fluxo de importação com prévia/desfazer, regras |
| 3 | Funções SQL + gráficos, orçamento, demo (seed + limpeza), Playwright, README/GIF |

Corte em caso de atraso (nesta ordem): categorização em lote, "copiar mês anterior". Núcleo intocável: importação, dashboard, demo.
