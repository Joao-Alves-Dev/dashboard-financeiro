# Cria ou atualiza .env.local para desenvolvimento local.
# Requer: CLI do Neon instalada (npm i -g neon@latest), `neon login` feito e a pasta ligada com `neon link`.
# Aponta o app para a branch `dev` (nunca para production) e gera os segredos que faltarem.
# Os segredos são gerados nesta máquina e gravados só no .env.local (ignorado pelo git).
# Variáveis já existentes que não são gerenciadas aqui são preservadas.

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz '.env.local'

$branches = neon branches list -o json | ConvertFrom-Json
if (-not ($branches | Where-Object { $_.name -eq 'dev' })) {
  Write-Host "Criando branch 'dev' no Neon..."
  neon branches create --name dev | Out-Null
}

$urlPooled = (neon connection-string dev --pooled).Trim()
$urlDireta = (neon connection-string dev).Trim()
if (-not $urlPooled.StartsWith('postgres') -or -not $urlDireta.StartsWith('postgres')) {
  throw "Não foi possível obter as connection strings da branch dev."
}

function Novo-Segredo {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}

# Lê o arquivo existente preservando a ordem
$vars = [ordered]@{}
if (Test-Path $destino) {
  foreach ($linha in [System.IO.File]::ReadAllLines($destino)) {
    if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { $vars[$Matches[1]] = $Matches[2] }
  }
}

# Sempre apontar para a branch dev
$vars['DATABASE_URL'] = $urlPooled
$vars['DATABASE_URL_UNPOOLED'] = $urlDireta
$vars['NEON_BRANCH'] = 'dev'

# Gerar/definir só o que faltar
if (-not $vars.Contains('BETTER_AUTH_SECRET') -or -not $vars['BETTER_AUTH_SECRET']) { $vars['BETTER_AUTH_SECRET'] = Novo-Segredo }
if (-not $vars.Contains('BETTER_AUTH_URL')) { $vars['BETTER_AUTH_URL'] = 'http://localhost:3000' }
if (-not $vars.Contains('NEXT_PUBLIC_EDICAO')) { $vars['NEXT_PUBLIC_EDICAO'] = 'pessoal' }
if (-not $vars.Contains('CRON_SECRET') -or -not $vars['CRON_SECRET']) { $vars['CRON_SECRET'] = Novo-Segredo }

$linhas = foreach ($k in $vars.Keys) { "$k=$($vars[$k])" }

# UTF-8 sem BOM (o BOM quebraria a leitura da primeira variável)
[System.IO.File]::WriteAllLines($destino, [string[]]$linhas, (New-Object System.Text.UTF8Encoding $false))
Write-Host ".env.local pronto: branch dev + BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_EDICAO e CRON_SECRET." -ForegroundColor Green
