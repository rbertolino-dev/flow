# Script de Deploy - Status do WhatsApp
# Execute no PowerShell: .\deploy-status-whatsapp.ps1

Write-Host '🚀 Iniciando deploy do Status do WhatsApp...' -ForegroundColor Cyan
Write-Host ''

# Verificar se está no diretório correto
if (-not (Test-Path "supabase")) {
    Write-Host '❌ Erro: Execute este script na raiz do projeto (agilize/)' -ForegroundColor Red
    exit 1
}

# Verificar se Supabase CLI está instalado
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabaseCli) {
    Write-Host '✅ Supabase CLI encontrado!' -ForegroundColor Green
    Write-Host ''
    
    # 1. Aplicar migração
    Write-Host '📦 Aplicando migração do banco de dados...' -ForegroundColor Yellow
    Write-Host '   Executando: supabase db push' -ForegroundColor White
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host '   ✅ Migração aplicada!' -ForegroundColor Green
    } else {
        Write-Host '   ⚠️  Erro ao aplicar migração via CLI' -ForegroundColor Yellow
        Write-Host '   📋 Aplique manualmente via Dashboard:' -ForegroundColor White
        Write-Host '      - SQL Editor > Cole o conteúdo de:' -ForegroundColor White
        Write-Host '        supabase/migrations/20250128000000_create_whatsapp_status_posts.sql' -ForegroundColor Green
    }
    Write-Host ''
    
    # 2. Deploy das funções
    Write-Host '⚡ Fazendo deploy das funções...' -ForegroundColor Yellow
    Write-Host ''
    
    Write-Host '   1. Deploy da função publish-whatsapp-status...' -ForegroundColor White
    supabase functions deploy publish-whatsapp-status
    if ($LASTEXITCODE -eq 0) {
        Write-Host '      ✅ Deploy concluído!' -ForegroundColor Green
    } else {
        Write-Host '      ❌ Erro no deploy!' -ForegroundColor Red
    }
    Write-Host ''
    
    Write-Host '   2. Deploy da função process-status-schedule...' -ForegroundColor White
    supabase functions deploy process-status-schedule
    if ($LASTEXITCODE -eq 0) {
        Write-Host '      ✅ Deploy concluído!' -ForegroundColor Green
    } else {
        Write-Host '      ❌ Erro no deploy!' -ForegroundColor Red
    }
    Write-Host ''
    
} else {
    Write-Host '⚠️  Supabase CLI não encontrado.' -ForegroundColor Yellow
    Write-Host '📋 Execute manualmente via Dashboard:' -ForegroundColor White
    Write-Host ''
    Write-Host '1️⃣  APLICAR MIGRAÇÃO:' -ForegroundColor Cyan
    Write-Host '   - Acesse: https://supabase.com/dashboard' -ForegroundColor White
    Write-Host '   - Vá em SQL Editor' -ForegroundColor White
    Write-Host '   - Abra: supabase/migrations/20250128000000_create_whatsapp_status_posts.sql' -ForegroundColor Green
    Write-Host '   - Cole TODO o conteúdo e execute' -ForegroundColor White
    Write-Host ''
    Write-Host '2️⃣  DEPLOY DAS FUNÇÕES:' -ForegroundColor Cyan
    Write-Host '   - Vá em Edge Functions' -ForegroundColor White
    Write-Host '   - Crie/atualize: publish-whatsapp-status' -ForegroundColor White
    Write-Host '   - Crie/atualize: process-status-schedule' -ForegroundColor White
    Write-Host '   - Copie o conteúdo dos arquivos em supabase/functions/' -ForegroundColor White
    Write-Host ''
}

# 3. Verificar build
Write-Host '🔨 Verificando build do frontend...' -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host '   ✅ Build OK!' -ForegroundColor Green
} else {
    Write-Host '   ❌ Erro no build!' -ForegroundColor Red
    exit 1
}
Write-Host ''

Write-Host '✨ Deploy concluído!' -ForegroundColor Green
Write-Host ''
Write-Host '📋 Verificação final:' -ForegroundColor Cyan
Write-Host '   1. Verifique se a tabela whatsapp_status_posts foi criada' -ForegroundColor White
Write-Host '   2. Verifique se as funções aparecem em Edge Functions' -ForegroundColor White
Write-Host '   3. Teste a aba "Status" na página de Disparo em Massa' -ForegroundColor White
Write-Host ''

