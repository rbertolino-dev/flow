# Script para aplicar migrações de grupos e anexos por mês
# Execute: .\aplicar-migracoes-grupos.ps1

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  APLICAR MIGRAÇÕES: Grupos e Anexos' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''

# Verificar se está no diretório correto
if (-not (Test-Path "supabase")) {
    Write-Host '❌ Erro: Execute este script na raiz do projeto (agilize/)' -ForegroundColor Red
    exit 1
}

Write-Host '📋 Instruções para aplicar as migrações:' -ForegroundColor Yellow
Write-Host ''
Write-Host 'OPÇÃO 1 - Via Supabase Dashboard (Recomendado):' -ForegroundColor Green
Write-Host '  1. Acesse: https://supabase.com/dashboard' -ForegroundColor White
Write-Host '  2. Selecione seu projeto' -ForegroundColor White
Write-Host '  3. Vá em SQL Editor' -ForegroundColor White
Write-Host '  4. Abra o arquivo: aplicar-migracoes-grupos.sql' -ForegroundColor White
Write-Host '  5. Cole todo o conteúdo e clique em RUN' -ForegroundColor White
Write-Host ''
Write-Host 'OPÇÃO 2 - Via Supabase CLI:' -ForegroundColor Green
Write-Host '  supabase db push' -ForegroundColor White
Write-Host ''
Write-Host 'OPÇÃO 3 - Via PowerShell (se tiver psql configurado):' -ForegroundColor Green
Write-Host '  $env:PGPASSWORD="sua_senha"' -ForegroundColor White
Write-Host '  psql -h db.orcbxgajfhgmjobsjlix.supabase.co -U postgres -d postgres -f aplicar-migracoes-grupos.sql' -ForegroundColor White
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  Verificações após aplicar:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '1. Verifique se a tabela foi criada:' -ForegroundColor White
Write-Host '   - Dashboard > Table Editor > whatsapp_workflow_groups' -ForegroundColor Gray
Write-Host ''
Write-Host '2. Verifique se as colunas foram adicionadas:' -ForegroundColor White
Write-Host '   - whatsapp_workflow_contact_attachments.month_reference' -ForegroundColor Gray
Write-Host '   - whatsapp_workflows.recipient_type' -ForegroundColor Gray
Write-Host '   - whatsapp_workflows.group_id' -ForegroundColor Gray
Write-Host ''
Write-Host '3. Verifique os índices:' -ForegroundColor White
Write-Host '   - Dashboard > Database > Indexes' -ForegroundColor Gray
Write-Host '   - Deve ter idx_whatsapp_workflow_groups_unique' -ForegroundColor Gray
Write-Host '   - Deve ter idx_whatsapp_workflow_contact_attachments_unique' -ForegroundColor Gray
Write-Host ''
Write-Host '✅ Pronto! As migrações estão prontas para aplicar.' -ForegroundColor Green
Write-Host ''

