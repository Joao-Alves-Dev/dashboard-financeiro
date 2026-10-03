# Dashboard Financeiro — Spec de Design (v1)

> Revisão 2 (2026-10-03): adicionadas duas edições (pessoal/portfólio), metas de poupança, PWA com lançamento rápido e orientador financeiro por regras. Ver seções "Edições" em diante. IA generativa descartada por custo; pode ser plugada depois.

## Contexto

Projeto 3 de 4 do portfólio definido na sessão "Segunda fonte de renda" (objetivo: segunda renda via freela em sistemas internos para pequenas empresas). Portfólio: Controle de estoque (existente), Gerador de cartão da farmácia (existente), **Dashboard financeiro (este)**, App de delivery (próximo).

Critério de sucesso: app publicado, demo acessível em um clique, README em formato de estudo de caso, sem cara de tutorial — diferenciais reais (importação de extrato, orçamento vs realizado, modo Pessoal/Empresa).

Restrições: 5-8h/semana, ~3 semanas para a v1. Supabase em **nova organização** (a atual está no limite de 2 projetos). Deploy na Vercel.

## Escopo por fase

- **v1 (este spec):** workspaces Pessoal/Empresa, contas, categorias, lançamentos (CRUD), importação CSV/OFX com prévia/dedupe/desfazer, regras de categorização, orçamento vs realizado, dashboard, demo isolada, **metas de poupança, PWA com lançamento rápido, orientador por regras + biblioteca "Aprenda"**.
- **Ordem de entrega:** núcleo comum → recursos pessoais (metas, PWA, orientador) → publicação pessoal → demo e material de portfólio.
- **Futuro opcional:** assistente com IA generativa (Claude API, Sonnet 5.5), ativado só se houver `ANTHROPIC_API_KEY`; reutiliza o contexto do orientador.
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

## Edições (pessoal / portfólio)

Mesmo código, dois deploys. Variável `NEXT_PUBLIC_EDICAO` (`pessoal` | `portfolio`) lida em `src/lib/edicao.ts`:

| Recurso | pessoal | portfolio |
|---|---|---|
| Demo anônima (landing com botão demo) | não | sim |
| Cadastro de novas contas | fechado (desabilitado no Supabase Auth; UI esconde) | aberto |
| Metas, PWA, orientador | sim | sim |

Infra: dois projetos Supabase na nova organização (`financeiro-pessoal`, `financeiro-portfolio`) com as mesmas migrações; dois projetos Vercel apontando para o mesmo repositório. Na edição pessoal, `/` redireciona para `/login` ou para o último workspace.

## Metas de poupança

Tabelas:

| Tabela | Campos |
|---|---|
| `metas` | id, workspace_id, nome, valor_alvo_centavos, data_alvo (date), criado_em, concluida_em (nullable) |
| `aportes_meta` | id, workspace_id, meta_id, data, valor_centavos, observacao |

- Aporte é dinheiro separado para a meta; **não** é lançamento (não altera resultado do mês). Retirada = aporte negativo.
- RLS igual às demais tabelas (`is_member(workspace_id)`).
- Função pura `calcularMeta({ alvo, guardado, dataAlvo, hoje, sobraMedia })` → `{ faltam, mesesRestantes, necessarioPorMes, sobraMedia, situacao: 'no_ritmo' | 'atrasada' | 'concluida' | 'vencida' }`. `mesesRestantes` conta o mês atual; mínimo 1. `sobraMedia` = média do `resultado` dos 3 últimos meses fechados (`resumo_mensal`).
- Tela `/w/[id]/metas`: cards com progresso, necessário/mês vs sobra média, registrar aporte. Card resumido no dashboard.

## PWA e uso no celular

- `src/app/manifest.ts` + ícones (192/512, maskable); instalável; sem modo offline.
- Layout mobile-first; em telas < 768px, barra inferior: Início, Lançamentos, **+**, Metas, Orientações. Desktop mantém navegação lateral/superior.
- Botão **+** abre o **lançamento rápido** (sheet): valor com `inputMode="decimal"`, tipo "saída" por padrão, chips das 6 categorias mais usadas nos últimos 60 dias (depois "mais…"), conta = última usada (cookie), data = hoje (editável), descrição opcional. Salvar com 1 toque.

## Orientador financeiro por regras

Sem IA, custo zero. Dois componentes:

**Motor de regras** (`src/features/orientador/regras/`): cada regra é função pura `(ctx: ContextoFinanceiro, cfg: ConfigOrientador) => Alerta | null`. `ContextoFinanceiro` contém: renda e saídas do mês atual, gastos por categoria (mês atual e média dos 3 anteriores), orçamento vs realizado, dia do mês e dias no mês, metas com `calcularMeta`, total da conta tipo `cartao` no mês, sobras dos últimos 3 meses.

| id | Dispara quando | Severidade | Dica ligada |
|---|---|---|---|
| `categoria-pct-renda` | gasto da categoria > `cfg.limiteCategoriaPct` (padrão 15) % da renda do mês | atencao | orcamento-50-30-20 |
| `orcamento-80` / `orcamento-100` | realizado ≥ 80% / ≥ 100% do orçado | atencao / critico | orcamento-realista |
| `mes-negativo` | projeção (saídas/dia decorrido × dias do mês) > renda do mês | critico | cortar-gastos |
| `categoria-alta` | categoria > média 3 meses × (1 + `cfg.altaPct`/100) (padrão 30) e média > 0 | atencao | revisar-habitos |
| `meta-atrasada` | situação `atrasada` | atencao | metas-ritmo |
| `sem-reserva` | nenhuma meta cujo nome contém "reserva" (case-insensitive) | info | reserva-emergencia |
| `sobra-consistente` | 3 últimos meses com resultado > 0 | positivo | onde-guardar |
| `cartao-alto` | saídas em contas `cartao` > `cfg.cartaoPct` (padrão 30) % da renda | atencao | juros-cartao |

Sem renda no mês, regras baseadas em % da renda não disparam. Alertas ordenados por severidade (critico > atencao > info > positivo). Dispensar um alerta grava `(regra_id, chave, mes)` em `alertas_dispensados`; ele volta se a severidade subir ou no mês seguinte.

Tabelas: `config_orientador` (workspace_id PK, limite_categoria_pct, alta_pct, cartao_pct) e `alertas_dispensados` (workspace_id, regra_id, chave, mes, severidade).

**Biblioteca "Aprenda"** (`src/features/orientador/conteudo/*.md` com frontmatter `id, titulo, tema, resumo`): temas Orçamento, Guardar, Dívidas, Investir (básico). Conteúdo educativo, em PT-BR, sem taxas ou rendimentos que envelhecem (indicar onde consultar). Aviso fixo: "Conteúdo educativo; não é recomendação de investimento." Conjunto inicial (ids): `orcamento-50-30-20`, `orcamento-realista`, `cortar-gastos`, `revisar-habitos`, `reserva-emergencia`, `onde-guardar`, `metas-ritmo`, `juros-cartao`, `quitar-dividas`, `juros-compostos`, `renda-fixa-basico`, `fgc`, `renda-variavel-risco`.

Telas: `/w/[id]/orientacoes` (alertas ativos + biblioteca com busca por título/resumo), `/w/[id]/orientacoes/[slug]` (texto), card no dashboard com os 3 alertas principais, limites editáveis em `/w/[id]/config`.

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

- Vitest (TDD): parse-ofx (fixtures anonimizadas estilo Itaú, Nubank, Inter), parse-csv (`;`, `1.234,56`, `dd/mm/aaaa`), money, id-externo, aplicar-regras, calcularMeta, cada regra do orientador, carregamento/validação do frontmatter da biblioteca (toda `dica` referenciada por regra existe).
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
| 3 | Funções SQL + gráficos, orçamento |
| 4 | Edições, metas, PWA + lançamento rápido |
| 5 | Orientador (regras + biblioteca), publicação pessoal |
| 6 | Demo (seed + limpeza), Playwright, README/GIF, publicação portfólio |

Corte em caso de atraso (nesta ordem): categorização em lote, "copiar mês anterior". Núcleo intocável: importação, dashboard, metas, orientador.
