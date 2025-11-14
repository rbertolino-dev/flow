# Script de Deploy - Workflows Periódicos WhatsApp
# Execute no PowerShell: .\deploy-workflows.ps1

Write-Host '🚀 Iniciando deploy dos workflows periódicos...' -ForegroundColor Cyan

# 1. Verificar se está no diretório correto
if (-not (Test-Path "supabase")) {
    Write-Host '❌ Erro: Execute este script na raiz do projeto (agilize/)' -ForegroundColor Red
    exit 1
}

# 2. Aplicar migração
Write-Host "" 
Write-Host '📦 Aplicando migração do banco de dados...' -ForegroundColor Yellow
Write-Host 'Execute manualmente no Supabase CLI:' -ForegroundColor White
Write-Host '  supabase db push' -ForegroundColor Green
Write-Host 'Ou via Supabase Dashboard > SQL Editor > Cole o conteúdo de:' -ForegroundColor White
Write-Host '  supabase/migrations/20251114130000_add_whatsapp_workflows.sql' -ForegroundColor Green

# 3. Deploy da função
Write-Host ""
Write-Host '⚡ Fazendo deploy da função process-whatsapp-workflows...' -ForegroundColor Yellow
Write-Host 'Execute:' -ForegroundColor White
Write-Host '  supabase functions deploy process-whatsapp-workflows' -ForegroundColor Green

# 4. Verificar build
Write-Host ""
Write-Host '🔨 Verificando build do frontend...' -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no build!" -ForegroundColor Red
    exit 1
}
Write-Host '✅ Build OK!' -ForegroundColor Green

# 5. Checklist de regressão
Write-Host ""
Write-Host '✅ Executando checklist de regressão...' -ForegroundColor Yellow
npm run regression
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erros no checklist!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host '✨ Deploy concluído!' -ForegroundColor Green
Write-Host ""
Write-Host '📋 Próximos passos manuais:' -ForegroundColor Cyan
Write-Host '  1. Configure o agendamento no Supabase Dashboard:' -ForegroundColor White
Write-Host '     - Vá em Database > Cron Jobs' -ForegroundColor White
Write-Host '     - Crie um novo job que chama process-whatsapp-workflows a cada 5 minutos' -ForegroundColor White
Write-Host '  2. Teste manualmente:' -ForegroundColor White
Write-Host '     - Acesse /whatsapp/workflows no app' -ForegroundColor White
Write-Host '     - Crie uma lista e um workflow de teste' -ForegroundColor White
Write-Host '     - Verifique se os scheduled_messages são criados corretamente' -ForegroundColor White

