# 🚀 Script de Preparação Completa para Deploy - Lovable Cloud
# Este script verifica e prepara tudo que é necessário para o deploy

Write-Host "🚀 Preparando Deploy Completo para Lovable Cloud..." -ForegroundColor Cyan
Write-Host ""

# Verificar se está no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Erro: Execute este script na pasta 'agilize'" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Diretório correto detectado" -ForegroundColor Green
Write-Host ""

# 1. Verificar Git Status
Write-Host "📋 1. Verificando status do Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  ATENÇÃO: Há mudanças não commitadas!" -ForegroundColor Yellow
    Write-Host "   Arquivos modificados:" -ForegroundColor Yellow
    $gitStatus | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }
    Write-Host ""
    $commit = Read-Host "   Deseja fazer commit antes do deploy? (s/n)"
    if ($commit -eq "s" -or $commit -eq "S") {
        $message = Read-Host "   Digite a mensagem do commit"
        if ($message) {
            git add .
            git commit -m $message
            Write-Host "✅ Commit realizado" -ForegroundColor Green
        }
    }
} else {
    Write-Host "✅ Working tree limpo" -ForegroundColor Green
}
Write-Host ""

# 2. Verificar sincronização com remoto
Write-Host "📋 2. Verificando sincronização com remoto..." -ForegroundColor Yellow
git fetch origin
$localCommit = git rev-parse HEAD
$remoteCommit = git rev-parse origin/main
if ($localCommit -ne $remoteCommit) {
    Write-Host "⚠️  Branch local não está sincronizada com remoto!" -ForegroundColor Yellow
    $pull = Read-Host "   Deseja puxar as mudanças do remoto? (s/n)"
    if ($pull -eq "s" -or $pull -eq "S") {
        git pull origin main
        Write-Host "✅ Pull realizado" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Branch sincronizada com remoto" -ForegroundColor Green
}
Write-Host ""

# 3. Verificar Node.js e npm
Write-Host "📋 3. Verificando Node.js e npm..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js ou npm não encontrado!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 4. Instalar dependências
Write-Host "📋 4. Instalando dependências..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependências instaladas" -ForegroundColor Green
Write-Host ""

# 5. Build do projeto
Write-Host "📋 5. Fazendo build do projeto..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build!" -ForegroundColor Red
    Write-Host "   Corrija os erros antes de continuar" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Build concluído com sucesso" -ForegroundColor Green
Write-Host ""

# 6. Verificar migrations
Write-Host "📋 6. Verificando migrations..." -ForegroundColor Yellow
$migrationsPath = "supabase\migrations"
if (Test-Path $migrationsPath) {
    $migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name
    Write-Host "✅ Encontradas $($migrations.Count) migrations" -ForegroundColor Green
    Write-Host "   ⚠️  Lembre-se de aplicar todas as migrations no Supabase Dashboard!" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Pasta de migrations não encontrada" -ForegroundColor Yellow
}
Write-Host ""

# 7. Verificar Edge Functions
Write-Host "📋 7. Verificando Edge Functions..." -ForegroundColor Yellow
$functionsPath = "supabase\functions"
if (Test-Path $functionsPath) {
    $functions = Get-ChildItem -Path $functionsPath -Directory | Where-Object { 
        $_.Name -ne "_shared" -and (Test-Path (Join-Path $_.FullName "index.ts"))
    }
    Write-Host "✅ Encontradas $($functions.Count) Edge Functions" -ForegroundColor Green
    Write-Host "   ⚠️  Lembre-se de fazer deploy de todas no Supabase Dashboard!" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Pasta de functions não encontrada" -ForegroundColor Yellow
}
Write-Host ""

# 8. Verificar variáveis de ambiente
Write-Host "📋 8. Checklist de Variáveis de Ambiente..." -ForegroundColor Yellow
Write-Host "   ⚠️  Verifique se as seguintes variáveis estão configuradas no Supabase:" -ForegroundColor Yellow
Write-Host "      - FACEBOOK_APP_ID" -ForegroundColor Gray
Write-Host "      - FACEBOOK_APP_SECRET" -ForegroundColor Gray
Write-Host "      - FACEBOOK_CLIENT_TOKEN" -ForegroundColor Gray
Write-Host "      - FACEBOOK_WEBHOOK_VERIFY_TOKEN" -ForegroundColor Gray
Write-Host "      - (Outras conforme necessário)" -ForegroundColor Gray
Write-Host ""

# 9. Resumo
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 RESUMO DA PREPARAÇÃO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Build concluído com sucesso" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS (Fazer no Supabase Dashboard):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Aplicar todas as migrations na ordem cronológica" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Fazer deploy de todas as Edge Functions" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Configurar variáveis de ambiente" -ForegroundColor White
Write-Host "      -> https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/functions" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Verificar tabelas, buckets e configurações" -ForegroundColor White
Write-Host ""
Write-Host "📖 Consulte o arquivo CHECKLIST-DEPLOY-COMPLETO-LOVABLE.md para detalhes" -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 10. Perguntar se quer fazer push
$push = Read-Host "Deseja fazer push para a nuvem agora? (s/n)"
if ($push -eq "s" -or $push -eq "S") {
    Write-Host ""
    Write-Host "📤 Fazendo push para origin/main..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Push concluído com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no push. Verifique e tente novamente." -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Preparação concluída!" -ForegroundColor Green
Write-Host ""

