# Script de Deploy - Workflows Periodicos
# Este script guia voce atraves do processo de deploy

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY - WORKFLOWS PERIODICOS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Build do frontend: OK" -ForegroundColor Green
Write-Host "`nPROXIMOS PASSOS PARA DEPLOY:`n" -ForegroundColor Yellow

Write-Host "1 - APLICAR MIGRACOES NO BANCO DE DADOS" -ForegroundColor Cyan
Write-Host "   Voce precisa aplicar 2 migracoes na ordem:" -ForegroundColor White
Write-Host "`n   a) Primeira migracao (tabelas principais):" -ForegroundColor Yellow
Write-Host "      - Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new" -ForegroundColor White
Write-Host "      - Arquivo: supabase\migrations\20251114130000_add_whatsapp_workflows.sql" -ForegroundColor White
Write-Host "`n   b) Segunda migracao (aprovacao e anexos por contato):" -ForegroundColor Yellow
Write-Host "      - Mesmo SQL Editor" -ForegroundColor White
Write-Host "      - Arquivo: supabase\migrations\20251114140000_add_workflow_approval_and_contact_files.sql" -ForegroundColor White
Write-Host "`n   IMPORTANTE: Cole TODO o conteudo de cada arquivo e clique em RUN`n" -ForegroundColor Red

Write-Host "2 - VERIFICAR SE AS TABELAS FORAM CRIADAS" -ForegroundColor Cyan
Write-Host "   - Va em Table Editor no Dashboard" -ForegroundColor White
Write-Host "   - Deve aparecer:" -ForegroundColor White
Write-Host "     - whatsapp_workflow_lists" -ForegroundColor Green
Write-Host "     - whatsapp_workflows" -ForegroundColor Green
Write-Host "     - whatsapp_workflow_attachments" -ForegroundColor Green
Write-Host "     - whatsapp_workflow_contact_attachments" -ForegroundColor Green
Write-Host "     - whatsapp_workflow_approvals" -ForegroundColor Green
Write-Host "   - Va em Storage e verifique se o bucket 'whatsapp-workflow-media' existe`n" -ForegroundColor White

Write-Host "3 - DEPLOY DA FUNCAO EDGE" -ForegroundColor Cyan
Write-Host "   - Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions" -ForegroundColor White
Write-Host "   - Clique em 'Create a new function'" -ForegroundColor White
Write-Host "   - Nome: process-whatsapp-workflows" -ForegroundColor White
Write-Host "   - Arquivo: supabase\functions\process-whatsapp-workflows\index.ts" -ForegroundColor White
Write-Host "   - Cole TODO o conteudo e clique em Deploy`n" -ForegroundColor White

Write-Host "4 - CONFIGURAR CRON JOB (OPCIONAL - pode fazer depois)" -ForegroundColor Cyan
Write-Host "   - Pegue seu SERVICE_ROLE_KEY em:" -ForegroundColor White
Write-Host "     https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/api" -ForegroundColor White
Write-Host "   - Role: service_role -> Copie a key" -ForegroundColor White
Write-Host "   - Execute o SQL abaixo (substitua SEU_SERVICE_ROLE_KEY):`n" -ForegroundColor White

$cronSQL = @'
-- Habilitar extensao pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar cron job (executa a cada 5 minutos)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    )
  );
  $$
);
'@

Write-Host $cronSQL -ForegroundColor Green
Write-Host "`n5 - TESTAR NO APP" -ForegroundColor Cyan
Write-Host "   - Execute: npm run dev" -ForegroundColor White
Write-Host "   - Acesse: http://localhost:5174/workflows" -ForegroundColor White
Write-Host "   - Crie uma lista e um workflow de teste`n" -ForegroundColor White

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRONTO PARA COPIAR OS ARQUIVOS!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Perguntar se quer abrir os arquivos
$abrir = Read-Host "Deseja abrir os arquivos de migracao e funcao no Notepad? (S/N)"
if ($abrir -eq "S" -or $abrir -eq "s") {
    Write-Host "`nAbrindo arquivos...`n" -ForegroundColor Yellow
    
    $migration1 = "supabase\migrations\20251114130000_add_whatsapp_workflows.sql"
    $migration2 = "supabase\migrations\20251114140000_add_workflow_approval_and_contact_files.sql"
    $functionFile = "supabase\functions\process-whatsapp-workflows\index.ts"
    
    if (Test-Path $migration1) {
        Start-Process notepad.exe $migration1
        Start-Sleep -Seconds 1
    }
    
    if (Test-Path $migration2) {
        Start-Process notepad.exe $migration2
        Start-Sleep -Seconds 1
    }
    
    if (Test-Path $functionFile) {
        Start-Process notepad.exe $functionFile
    }
    
    Write-Host "Arquivos abertos!" -ForegroundColor Green
    Write-Host "   Agora e so copiar e colar no Dashboard conforme as instrucoes acima.`n" -ForegroundColor White
}

Write-Host "`nDICA: Mantenha este terminal aberto para consultar as instrucoes enquanto faz o deploy.`n" -ForegroundColor Yellow
