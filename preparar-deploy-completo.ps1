# Script de Preparacao Completa para Deploy - Lovable Cloud
# Este script verifica e prepara tudo que e necessario para o deploy

Write-Host "Preparando Deploy Completo para Lovable Cloud..." -ForegroundColor Cyan
Write-Host ""

# Verificar se esta no diretorio correto
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: Execute este script na pasta 'agilize'" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Diretorio correto detectado" -ForegroundColor Green
Write-Host ""

# 1. Verificar Git Status
Write-Host "[1/8] Verificando status do Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "ATENCAO: Ha mudancas nao commitadas!" -ForegroundColor Yellow
    Write-Host "   Arquivos modificados:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
    Write-Host ""
    $commit = Read-Host "   Deseja fazer commit antes do deploy? (s/n)"
    if ($commit -eq "s" -or $commit -eq "S") {
        $message = Read-Host "   Digite a mensagem do commit"
        if ($message) {
            git add .
            git commit -m $message
            Write-Host "[OK] Commit realizado" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[OK] Working tree limpo" -ForegroundColor Green
}
Write-Host ""

# 2. Verificar sincronizacao com remoto
Write-Host "[2/8] Verificando sincronizacao com remoto..." -ForegroundColor Yellow
git fetch origin
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main
if ($localCommit -ne $remoteCommit) {
    Write-Host "ATENCAO: Branch local nao esta sincronizada com remoto!" -ForegroundColor Yellow
    $pull = Read-Host "   Deseja puxar as mudancas do remoto? (s/n)"
    if ($pull -eq "s" -or $pull -eq "S") {
        git pull origin main
        Write-Host "[OK] Pull realizado" -ForegroundColor Green
    }
} else {
    Write-Host "[OK] Branch sincronizada com remoto" -ForegroundColor Green
}
Write-Host ""

# 3. Verificar Node.js e npm
Write-Host "[3/8] Verificando Node.js e npm..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "[OK] npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERRO: Node.js ou npm nao encontrado!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Instalar dependencias
Write-Host "[4/8] Instalando dependencias..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Erro ao instalar dependencias!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencias instaladas" -ForegroundColor Green
Write-Host ""

# 5. Build do projeto
Write-Host "[5/8] Fazendo build do projeto..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: Erro no build!" -ForegroundColor Red
    Write-Host "   Corrija os erros antes de continuar" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Build concluido com sucesso" -ForegroundColor Green
Write-Host ""

# 6. Verificar migrations
Write-Host "[6/8] Verificando migrations..." -ForegroundColor Yellow
$migrationsPath = "supabase\migrations"
if (Test-Path $migrationsPath) {
    $migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name
    Write-Host "[OK] Encontradas $($migrations.Count) migrations" -ForegroundColor Green
    Write-Host "   ATENCAO: Lembre-se de aplicar todas as migrations no Supabase Dashboard!" -ForegroundColor Yellow
} else {
    Write-Host "ATENCAO: Pasta de migrations nao encontrada" -ForegroundColor Yellow
}
Write-Host ""

# 7. Verificar Edge Functions
Write-Host "[7/8] Verificando Edge Functions..." -ForegroundColor Yellow
$functionsPath = "supabase\functions"
if (Test-Path $functionsPath) {
    $functions = Get-ChildItem -Path $functionsPath -Directory | Where-Object { 
        $_.Name -ne "_shared" -and (Test-Path (Join-Path $_.FullName "index.ts"))
    }
    Write-Host "[OK] Encontradas $($functions.Count) Edge Functions" -ForegroundColor Green
    Write-Host "   ATENCAO: Lembre-se de fazer deploy de todas no Supabase Dashboard!" -ForegroundColor Yellow
} else {
    Write-Host "ATENCAO: Pasta de functions nao encontrada" -ForegroundColor Yellow
}
Write-Host ""

# 8. Verificar variaveis de ambiente
Write-Host "[8/8] Checklist de Variaveis de Ambiente..." -ForegroundColor Yellow
Write-Host "   ATENCAO: Verifique se as seguintes variaveis estao configuradas no Supabase:" -ForegroundColor Yellow
Write-Host "      - FACEBOOK_APP_ID" -ForegroundColor Gray
Write-Host "      - FACEBOOK_APP_SECRET" -ForegroundColor Gray
Write-Host "      - FACEBOOK_CLIENT_TOKEN" -ForegroundColor Gray
Write-Host "      - FACEBOOK_WEBHOOK_VERIFY_TOKEN" -ForegroundColor Gray
Write-Host "      - (Outras conforme necessario)" -ForegroundColor Gray
Write-Host ""

# 9. Resumo
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "RESUMO DA PREPARACAO" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Build concluido com sucesso" -ForegroundColor Green
Write-Host ""
Write-Host "PROXIMOS PASSOS (Fazer no Supabase Dashboard):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Aplicar todas as migrations na ordem cronologica" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Fazer deploy de todas as Edge Functions" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Configurar variaveis de ambiente" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/functions" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Verificar tabelas, buckets e configuracoes" -ForegroundColor White
Write-Host ""
Write-Host "Consulte o arquivo CHECKLIST-DEPLOY-COMPLETO-LOVABLE.md para detalhes" -ForegroundColor Cyan
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# 10. Perguntar se quer fazer push
$push = Read-Host "Deseja fazer push para a nuvem agora? (s/n)"
if ($push -eq "s" -or $push -eq "S") {
    Write-Host ""
    Write-Host "Fazendo push para origin/main..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Push concluido com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "ERRO: Erro no push. Verifique e tente novamente." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[OK] Preparacao concluida!" -ForegroundColor Green
Write-Host ""
