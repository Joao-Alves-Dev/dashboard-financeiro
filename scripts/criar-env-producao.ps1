# Cria ou atualiza .env.production.local (ignorado pelo git) para a PUBLICAÇÃO da edição pessoal.
# Requer: CLI do Neon instalada, `neon login` feito e a pasta ligada com `neon link`.
# Aponta SOMENTE para a branch `production` do Neon (recusa qualquer outro nome) e gera segredos NOVOS
# nesta máquina (nunca reaproveita os do dev). Nenhum segredo é impresso.
# Chaves já existentes são preservadas (exceto DATABASE_URL_UNPOOLED e NEON_BRANCH, que são sempre
# atualizadas). DATABASE_URL (role app_user) NÃO é criada aqui: vem de `npm run db:criar-role-app`.

param([string]$Branch = 'production')

$ErrorActionPreference = 'Stop'

if ($Branch -ne 'production') {
  throw "Este script só trabalha com a branch 'production' (recebido: '$Branch'). Nada foi feito."
}

$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz '.env.production.local'
$envDev = Join-Path $raiz '.env.local'

$branches = neon branches list -o json | ConvertFrom-Json
if (-not ($branches | Where-Object { $_.name -eq 'production' })) {
  throw "Não existe uma branch chamada 'production' no projeto Neon ligado a esta pasta. Nada foi feito."
}

# Conexão DIRETA (sem pooler) do dono da branch, usada só em migrações e scripts administrativos.
$urlDireta = (neon connection-string production).Trim()
if (-not $urlDireta.StartsWith('postgres')) {
  throw 'Não foi possível obter a connection string da branch production.'
}
if ($urlDireta -match '-pooler') {
  throw 'A connection string obtida é do pooler; esperada a conexão direta. Nada foi feito.'
}
if ($urlDireta -match '^postgres(ql)?://app_user[:@]') {
  throw 'A connection string obtida é do app_user; esperada a do dono da branch. Nada foi feito.'
}

function Novo-Segredo {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}

function Ler-Env([string]$caminho) {
  $v = [ordered]@{}
  if (Test-Path $caminho) {
    foreach ($linha in [System.IO.File]::ReadAllLines($caminho)) {
      if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { $v[$Matches[1]] = $Matches[2] }
    }
  }
  return $v
}

$vars = Ler-Env $destino
$dev = Ler-Env $envDev

# Sempre atualizadas
$vars['DATABASE_URL_UNPOOLED'] = $urlDireta
$vars['NEON_BRANCH'] = 'production'

# Segredos: gera se faltar, ou se for igual ao do dev (nunca reaproveitar)
foreach ($chave in 'BETTER_AUTH_SECRET', 'CRON_SECRET') {
  $atual = if ($vars.Contains($chave)) { $vars[$chave] } else { '' }
  $doDev = if ($dev.Contains($chave)) { $dev[$chave] } else { $null }
  if (-not $atual -or ($doDev -and $atual -eq $doDev)) { $vars[$chave] = Novo-Segredo }
}

if (-not $vars.Contains('BETTER_AUTH_URL') -or -not $vars['BETTER_AUTH_URL']) {
  $vars['BETTER_AUTH_URL'] = 'https://PREENCHER.vercel.app'
}
if (-not $vars.Contains('NEXT_PUBLIC_EDICAO') -or -not $vars['NEXT_PUBLIC_EDICAO']) {
  $vars['NEXT_PUBLIC_EDICAO'] = 'pessoal'
}

$linhas = foreach ($k in $vars.Keys) { "$k=$($vars[$k])" }

# UTF-8 sem BOM (o BOM quebraria a leitura da primeira variável)
[System.IO.File]::WriteAllLines($destino, [string[]]$linhas, (New-Object System.Text.UTF8Encoding $false))
Write-Host '.env.production.local pronto: branch production, BETTER_AUTH_SECRET e CRON_SECRET novos, NEXT_PUBLIC_EDICAO=pessoal.' -ForegroundColor Green
if ($vars['BETTER_AUTH_URL'] -like '*PREENCHER*') {
  Write-Host 'Falta trocar BETTER_AUTH_URL pela URL da Vercel (depois do primeiro deploy) e rodar db:criar-role-app para criar DATABASE_URL.' -ForegroundColor Yellow
}
