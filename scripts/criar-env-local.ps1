# Cria .env.local para desenvolvimento local.
# Requer: CLI do Neon instalada (npm i -g neon@latest), `neon login` feito e a pasta ligada com `neon link`.
# Os segredos são gerados nesta máquina e gravados só no .env.local (ignorado pelo git).

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$destino = Join-Path $raiz '.env.local'

if (Test-Path $destino) {
  Write-Host ".env.local já existe; nada foi alterado. Apague-o se quiser recriar." -ForegroundColor Yellow
  exit 1
}

$branches = neon branches list -o json | ConvertFrom-Json
if (-not ($branches | Where-Object { $_.name -eq 'dev' })) {
  Write-Host "Criando branch 'dev' no Neon..."
  neon branches create --name dev | Out-Null
}

$databaseUrl = (neon connection-string dev --pooled).Trim()
if (-not $databaseUrl.StartsWith('postgres')) {
  throw "Não foi possível obter a connection string da branch dev."
}

function Novo-Segredo {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  [Convert]::ToBase64String($bytes)
}

$linhas = @(
  "DATABASE_URL=$databaseUrl",
  "BETTER_AUTH_SECRET=$(Novo-Segredo)",
  "BETTER_AUTH_URL=http://localhost:3000",
  "NEXT_PUBLIC_EDICAO=pessoal",
  "CRON_SECRET=$(Novo-Segredo)"
)

# UTF-8 sem BOM (o BOM quebraria a leitura da primeira variável)
[System.IO.File]::WriteAllLines($destino, $linhas, (New-Object System.Text.UTF8Encoding $false))
Write-Host ".env.local criado com DATABASE_URL (branch dev), BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_EDICAO e CRON_SECRET." -ForegroundColor Green
