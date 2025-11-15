# Script para aplicar migracao de boletos no Supabase
# Execute: .\aplicar-migracao-boletos.ps1

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  APLICAR MIGRACAO DE BOLETOS' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''

# Verificar se o arquivo existe
$sqlFile = "supabase/migrations/20251115020000_add_boleto_tracking.sql"
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
Write-Host '4. Clique em New query' -ForegroundColor White
Write-Host ''
Write-Host '5. Cole o conteudo (Ctrl+V) - ja esta na area de transferencia!' -ForegroundColor Green
Write-Host ''
Write-Host '6. Clique em RUN ou pressione Ctrl+Enter' -ForegroundColor White
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  VERIFICACOES APOS APLICAR:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'No Dashboard > Table Editor, verifique:' -ForegroundColor White
Write-Host '  - whatsapp_boletos (nova tabela)' -ForegroundColor Gray
Write-Host '  - Deve ter colunas: id, organization_id, lead_id, asaas_payment_id, valor, etc' -ForegroundColor Gray
Write-Host ''
Write-Host 'Ou execute no SQL Editor:' -ForegroundColor White
Write-Host '  SELECT * FROM information_schema.tables WHERE table_name = ''whatsapp_boletos'';' -ForegroundColor Gray
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'DICA: O conteudo SQL ja esta na sua area de transferencia!' -ForegroundColor Yellow
Write-Host '   Basta abrir o Dashboard e colar (Ctrl+V)' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Pressione qualquer tecla para abrir o Dashboard...' -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Tentar abrir o Dashboard no navegador
Start-Process "https://supabase.com/dashboard"

Write-Host ''
Write-Host 'Dashboard aberto no navegador!' -ForegroundColor Green
Write-Host 'Agora e so colar o SQL no SQL Editor (Ctrl+V)' -ForegroundColor Yellow
Write-Host ''

