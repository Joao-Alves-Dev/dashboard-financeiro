# Publicar a edição pessoal (Neon + Vercel)

Guia para você (dono do projeto) publicar o app só para você e para o seu pai. Todos os comandos são digitados no **PowerShell, dentro da pasta `D:\Portfolio\dashboard-financeiro`**. Sempre que um comando perguntar algo, a resposta é digitada no próprio terminal.

Regras que valem o guia inteiro:

- Segredos (senhas, chaves, connection strings) **nunca** são colados em chat, e-mail ou arquivo versionado. Os scripts daqui não os imprimem.
- A **URL final do app é privada**: fica só com você e com o seu pai. Não vai para o README, para o GitHub nem para redes sociais.
- Quando um comando mostrar um quadro com `Branch do Neon: production  <-- PRODUÇÃO`, ele vai pedir que você **digite a palavra `production`**. Isso é de propósito: confira o quadro antes de confirmar.

Ordem geral: **criar o arquivo de ambiente → criar a role do app → migrar → Vercel → atualizar a URL → criar usuários → verificar**.

---

## Antes de começar

Você precisa de: CLI do Neon instalada e logada (`neon login`), pasta ligada ao projeto Neon (`neon link`), e uma branch chamada **`production`** no projeto `financeiro-pessoal`. Para conferir:

```powershell
neon branches list
```

Esperado: uma lista em que aparece uma linha com o nome `production`. Se ela não existir, crie no painel do Neon (ou `neon branches create --name production`) antes de continuar.

---

## (a) Criar `.env.production.local`

```powershell
powershell -ExecutionPolicy Bypass -File scripts\criar-env-producao.ps1
```

Esperado (em verde): `.env.production.local pronto: branch production, BETTER_AUTH_SECRET e CRON_SECRET novos, NEXT_PUBLIC_EDICAO=pessoal.` e, em amarelo, um lembrete de que falta a URL da Vercel.

O que o script faz: grava o arquivo `.env.production.local` (ignorado pelo git) com a conexão direta do **dono** da branch `production` (`DATABASE_URL_UNPOOLED`), `NEON_BRANCH=production`, segredos **novos** (`BETTER_AUTH_SECRET`, `CRON_SECRET`; nunca reaproveita os do dev), `NEXT_PUBLIC_EDICAO=pessoal` e `BETTER_AUTH_URL=https://PREENCHER.vercel.app` (você troca depois). Ele se recusa a rodar se a branch alvo não se chamar `production`. Pode rodar de novo à vontade: chaves que já existem são preservadas.

## (b) Criar a role `app_user` e a `DATABASE_URL`

```powershell
npm run db:criar-role-app -- --arquivo .env.production.local
```

Esperado:

```
Role app_user criada.
Verificado: app_user sem BYPASSRLS, sem superuser, fora de neon_superuser.
DATABASE_URL atualizada no arquivo para app_user (pooled).
```

Isso cria o usuário de banco usado pelo app (sem poderes de administrador) e grava a `DATABASE_URL` dele em `.env.production.local`. **Tem que vir antes da migração**: uma das migrações concede permissões a essa role e falha se ela não existir.

## (c) Aplicar as migrações em produção

```powershell
npm run db:migrate:prod
```

Esperado: o quadro (`APLICAR MIGRAÇÕES`, arquivo, host do banco, `Branch do Neon: production  <-- PRODUÇÃO`), a pergunta `Digite "production" para confirmar:` (digite `production` e Enter) e, no fim, `migrations applied successfully!`.

Se aparecer `Recusado: ...`, leia a mensagem: ela indica arquivo e branch que não combinam. Nada foi alterado nesse caso.

---

## (d) Vercel: criar o projeto

1. Em vercel.com: **Add New → Project** → importe o repositório `dashboard-financeiro`.
2. **Framework Preset: Next.js** (detectado sozinho).
3. **Antes de clicar em Deploy**, abra **Environment Variables** e crie as 5 variáveis abaixo (marque Production; pode marcar todos os ambientes):

| Variável | Valor | De onde vem |
|---|---|---|
| `DATABASE_URL` | URL do **app_user**, pooled | `.env.production.local`. **Nunca** a `DATABASE_URL_UNPOOLED` (é a do dono do banco). |
| `BETTER_AUTH_SECRET` | segredo novo | `.env.production.local` |
| `BETTER_AUTH_URL` | `https://PREENCHER.vercel.app` por enquanto | você troca no passo (e) |
| `NEXT_PUBLIC_EDICAO` | `pessoal` | a Vercel precisa dela **no build** (o Next grava esse valor no código); por isso tem que existir antes do primeiro deploy |
| `CRON_SECRET` | segredo novo | `.env.production.local` |

**Para colar os valores sem exibi-los:** o comando abaixo copia o valor para a área de transferência (Windows) e só diz quantos caracteres copiou. Depois é só colar (Ctrl+V) no campo *Value* da Vercel. Repita para cada chave.

```powershell
npm run env:copiar -- DATABASE_URL --arquivo .env.production.local
npm run env:copiar -- BETTER_AUTH_SECRET --arquivo .env.production.local
npm run env:copiar -- CRON_SECRET --arquivo .env.production.local
```

Esperado: `Copiado DATABASE_URL de .env.production.local (N caracteres). Cole com Ctrl+V; o valor não foi exibido.`

(`NEXT_PUBLIC_EDICAO=pessoal` e `BETTER_AUTH_URL` são curtos e não secretos: pode digitar.) Atenção: nunca use o prefixo `NEXT_PUBLIC_` em nada secreto; tudo com esse prefixo vai para o navegador de quem visitar o site.

4. Clique em **Deploy**. Aguarde terminar.

**Região das funções (conferir uma vez):** o banco Neon está em `aws-us-east-2` (Ohio). A região padrão das funções da Vercel para projetos novos é `iad1` (Washington D.C.), a mais próxima. Confirme em **Settings → Functions → Function Region** que está **Washington, D.C., USA (iad1)**. Se estiver outra, troque e faça redeploy. Não é necessário `vercel.json`.

## (e) Depois do primeiro deploy: informar a URL e redeployar

1. Na Vercel, abra o projeto e copie a **URL de produção** (algo como `https://seu-projeto.vercel.app`; ela aparece em *Domains*).
2. Edite `.env.production.local` e troque `BETTER_AUTH_URL=https://PREENCHER.vercel.app` pela URL real (sem barra no final). Salve.
3. Na Vercel: **Settings → Environment Variables → `BETTER_AUTH_URL` → Edit** e cole a mesma URL. (Se preferir, `npm run env:copiar -- BETTER_AUTH_URL --arquivo .env.production.local` e Ctrl+V.)
4. **Redeploy**: aba **Deployments** → menu `...` do deploy mais recente → **Redeploy**. Variáveis só valem em deploys novos, então sem este passo o login falha com erro de origem.

---

## (f) Criar os usuários e o vínculo entre eles

Cada usuário é criado por você, no terminal, apontando para produção. As senhas são digitadas no terminal (não aparecem na tela). A pessoa depois pode usar a senha que você definiu; combine a troca com ela.

Usuário 1 (você):

```powershell
npm run criar-usuario -- --arquivo .env.production.local
```

Esperado: quadro com `Branch do Neon: production  <-- PRODUÇÃO` → digite `production` → `Nome:` → `E-mail:` → `Senha (mín. 8 caracteres...)` → `Repita a senha:` → `Usuário criado: ...`.

Usuário 2 (seu pai): rode o **mesmo comando de novo** com o nome e o e-mail dele.

Mensagens possíveis: `Já existe um usuário com este e-mail.` (e-mail repetido) e `A senha precisa ter pelo menos 8 caracteres.`

**Workspaces:** cada pessoa entra no app, faz login e cria o seu workspace. Você cria **"Pessoal"**; o seu pai cria **"Pai"** (ou você cria "Pai" logado como ele, no celular dele).

**Entrar como membro do workspace do pai** (depois de o workspace "Pai" existir):

```powershell
npm run adicionar-membro -- --arquivo .env.production.local
```

Ele pergunta: e-mail do **dono** do workspace (seu pai), nome do workspace (`Pai`) e e-mail de quem vai entrar (o seu). Esperado: `Pronto: ... agora é membro do workspace "Pai".` Rodar de novo é seguro (`já tem acesso ... Nada a fazer`). Se o dono tiver dois workspaces com o mesmo nome, o script lista os ids e pede para renomear um deles no app.

> Este script é uma ferramenta administrativa local e usa a conexão do **dono do banco** (`DATABASE_URL_UNPOOLED`), porque o usuário do app (`app_user`) não pode gravar em `workspace_members` (de propósito, para ninguém se adicionar a um workspace alheio pelo app). Ele nunca é parte do app publicado.

---

## (g) Checklist de verificação

Faça nesta ordem, usando a URL de produção.

1. **Cadastro fechado.** Tentar criar conta por outro e-mail precisa falhar. No PowerShell (troque a URL; o e-mail é só de teste e não deve ser criado):

   ```powershell
   curl.exe -s -i -X POST "https://SUA-URL.vercel.app/api/auth/sign-up/email" -H "Content-Type: application/json" -H "Origin: https://SUA-URL.vercel.app" -d "{\"name\":\"X\",\"email\":\"naocriar@exemplo.com\",\"password\":\"12345678abc\"}"
   ```

   Esperado: `HTTP/1.1 400` e no corpo `EMAIL_PASSWORD_SIGN_UP_DISABLED`. Também: abrir `/cadastro` no navegador deve redirecionar para o login.
2. **Login** com o usuário 1 no computador.
3. **Criar os workspaces** "Pessoal" e "Pai" (conforme (f)) e **fazer um lançamento**; ele deve aparecer na lista.
4. **Instalar na tela inicial:**
   - Android (Chrome): menu `⋮` → **Instalar app** (ou *Adicionar à tela inicial*).
   - iPhone (Safari): botão **Compartilhar** → **Adicionar à Tela de Início**.
5. **Voz no celular do pai.** No Chrome do Android o reconhecimento de voz funciona: abra o workspace, toque no botão de voz, autorize o microfone e diga algo como "paguei vinte e cinco reais de gasolina". Confira a prévia e confirme. **No iPhone o reconhecimento de voz do navegador pode não funcionar** (depende da versão do iOS e do Safari); se o botão não aparecer ou der erro, use a opção **"Digitar a frase"** do mesmo diálogo, que faz a mesma interpretação a partir do texto. O lançamento criado deve aparecer, e o workspace "Pai" deve aparecer no seletor de workspace da **sua** conta (depois de `adicionar-membro`).
6. **Exportar lista e compartilhar:** na tela de exportação, gere a lista por favorecido e período e use **Compartilhar** para enviar ao WhatsApp (no celular).

Se algum item falhar, veja **Settings → Logs** do projeto na Vercel antes de mexer em qualquer coisa.

---

## (h) Reverter, rotacionar segredos, desfazer deploy

- **Rotacionar a senha do banco do app:** `npm run db:criar-role-app -- --arquivo .env.production.local` (o quadro de produção não aparece neste script; confira que o arquivo é o de produção). Isso troca a senha do `app_user` e atualiza `DATABASE_URL` no arquivo. Depois: copie o novo valor (`npm run env:copiar -- DATABASE_URL --arquivo .env.production.local`), atualize `DATABASE_URL` na Vercel e **redeploy**. Entre a troca e o redeploy o app fica sem acesso ao banco.
- **Rotacionar `BETTER_AUTH_SECRET`:** troque o valor no arquivo (apague a linha e rode `criar-env-producao.ps1`, que gera um novo) e na Vercel e redeploy. Efeito: todos precisam fazer login de novo.
- **Rotacionar `CRON_SECRET`:** mesmo processo; sem efeito para o usuário na edição pessoal.
- **Deploy ruim:** Vercel → **Deployments** → escolha o último deploy bom → menu `...` → **Promote to Production** (ou *Instant Rollback*). É imediato e não mexe no banco. Migrações aplicadas **não** são desfeitas por isso; por isso as migrações do projeto são feitas para serem compatíveis com a versão anterior do código.
- **Banco:** o Neon mantém histórico para restaurar a branch a um ponto no tempo (painel do Neon → Branches → Restore). Use só em caso grave.

## (i) O que NÃO commitar

Nunca versionar: `.env.local`, `.env.production.local` (o `.gitignore` cobre `.env*.local`, mas confira o `git status` antes de cada commit), qualquer connection string, senha, `BETTER_AUTH_SECRET` ou `CRON_SECRET`, e a **URL final da Vercel** (não coloque no README nem em issues). Se algum segredo vazar: rotacione conforme (h) imediatamente.

---

## Resumo dos comandos, em ordem

```powershell
neon branches list
powershell -ExecutionPolicy Bypass -File scripts\criar-env-producao.ps1
npm run db:criar-role-app -- --arquivo .env.production.local
npm run db:migrate:prod
# Vercel: criar projeto, variáveis, Deploy; conferir Function Region = iad1
# editar BETTER_AUTH_URL (arquivo + Vercel) e Redeploy
npm run criar-usuario -- --arquivo .env.production.local      # você
npm run criar-usuario -- --arquivo .env.production.local      # seu pai
# cada um faz login e cria o workspace ("Pessoal", "Pai")
npm run adicionar-membro -- --arquivo .env.production.local
```
