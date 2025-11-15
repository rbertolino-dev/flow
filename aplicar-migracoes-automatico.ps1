# Script para aplicar migracoes no Supabase
# Este script prepara tudo para voce aplicar facilmente

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  APLICAR MIGRACOES NO SUPABASE' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''

# Verificar se o arquivo existe
$sqlFile = "aplicar-todas-migracoes.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "Erro: Arquivo $sqlFile nao encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host 'Arquivo SQL encontrado!' -ForegroundColor Green
Write-Host ''

# Ler o conteudo do arquivo
$sqlContent = Get-Content $sqlFile -Raw

# Copiar para o clipboard
$sqlContent | Set-Clipboard

Write-Host 'Conteudo SQL copiado para a area de transferencia!' -ForegroundColor Green
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  PROXIMOS PASSOS:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '1. Abra o Supabase Dashboard:' -ForegroundColor White
Write-Host '   https://supabase.com/dashboard' -ForegroundColor Cyan
Write-Host ''
Write-Host '2. Selecione seu projeto' -ForegroundColor White
Write-Host ''
Write-Host '3. Va em SQL Editor (menu lateral)' -ForegroundColor White
Write-Host ''
Write-Host '4. Cole o conteudo (Ctrl+V) - ja esta na area de transferencia!' -ForegroundColor Green
Write-Host ''
Write-Host '5. Clique em RUN ou pressione Ctrl+Enter' -ForegroundColor White
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  VERIFICACOES APOS APLICAR:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'No Dashboard > Table Editor, verifique:' -ForegroundColor White
Write-Host '  - whatsapp_workflow_groups (nova tabela)' -ForegroundColor Gray
Write-Host '  - asaas_configs (nova tabela)' -ForegroundColor Gray
Write-Host '  - whatsapp_workflow_contact_attachments.month_reference (nova coluna)' -ForegroundColor Gray
Write-Host '  - whatsapp_workflows.recipient_type (nova coluna)' -ForegroundColor Gray
Write-Host '  - whatsapp_workflows.group_id (nova coluna)' -ForegroundColor Gray
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  PROXIMOS PASSOS APOS MIGRACOES:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '1. Deploy da funcao Asaas:' -ForegroundColor White
Write-Host '   supabase functions deploy asaas-create-charge' -ForegroundColor Gray
Write-Host ''
Write-Host '2. Deploy da funcao de workflows:' -ForegroundColor White
Write-Host '   supabase functions deploy process-whatsapp-workflows' -ForegroundColor Gray
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'DICA: O conteudo SQL ja esta na sua area de transferencia!' -ForegroundColor Yellow
Write-Host '   Basta abrir o Dashboard e colar' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Pressione qualquer tecla para abrir o Dashboard...' -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Tentar abrir o Dashboard no navegador
Start-Process "https://supabase.com/dashboard"

Write-Host ''
Write-Host 'Dashboard aberto no navegador!' -ForegroundColor Green
Write-Host 'Agora e so colar o SQL no SQL Editor' -ForegroundColor Yellow
Write-Host ''
