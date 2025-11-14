# Script para Preparar Arquivos de Deploy
# Este script prepara todos os arquivos necessários para você copiar e colar no Dashboard

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PREPARANDO ARQUIVOS PARA DEPLOY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$migrationFile = "supabase\migrations\20251114130000_add_whatsapp_workflows.sql"
$functionFile = "supabase\functions\process-whatsapp-workflows\index.ts"

# Verificar se os arquivos existem
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERRO: Arquivo de migração não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $functionFile)) {
    Write-Host "ERRO: Arquivo da função não encontrado: $functionFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Arquivos encontrados!" -ForegroundColor Green
Write-Host "`n📋 PRÓXIMOS PASSOS:`n" -ForegroundColor Yellow

Write-Host "1️⃣  APLICAR MIGRAÇÃO:" -ForegroundColor Cyan
Write-Host "   - Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new" -ForegroundColor White
Write-Host "   - Abra o arquivo: $migrationFile" -ForegroundColor White
Write-Host "   - Copie TODO o conteúdo e cole no SQL Editor" -ForegroundColor White
Write-Host "   - Clique em RUN`n" -ForegroundColor White

Write-Host "2️⃣  DEPLOY DA FUNÇÃO:" -ForegroundColor Cyan
Write-Host "   - Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions" -ForegroundColor White
Write-Host "   - Clique em 'Create a new function'" -ForegroundColor White
Write-Host "   - Nome: process-whatsapp-workflows" -ForegroundColor White
Write-Host "   - Abra o arquivo: $functionFile" -ForegroundColor White
Write-Host "   - Copie TODO o conteúdo e cole no editor" -ForegroundColor White
Write-Host "   - Clique em Deploy`n" -ForegroundColor White

Write-Host "3️⃣  CRIAR CRON JOB:" -ForegroundColor Cyan
Write-Host "   - Pegue seu SERVICE_ROLE_KEY em:" -ForegroundColor White
Write-Host "     https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/api" -ForegroundColor White
Write-Host "   - Role: service_role -> Copie a key" -ForegroundColor White
Write-Host "   - Execute o SQL abaixo (substitua SEU_SERVICE_ROLE_KEY):`n" -ForegroundColor White

$cronSQL = @"
-- Habilitar extensão pg_cron
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
"@

Write-Host $cronSQL -ForegroundColor Green
Write-Host "`n4️⃣  TESTAR:" -ForegroundColor Cyan
Write-Host "   - Execute: npm run dev" -ForegroundColor White
Write-Host "   - Acesse: http://localhost:5173/whatsapp/workflows" -ForegroundColor White
Write-Host "   - Crie uma lista e um workflow de teste`n" -ForegroundColor White

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ARQUIVOS PRONTOS PARA COPIAR!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Abrir os arquivos no editor padrão para facilitar
Write-Host "Abrindo arquivos para você copiar...`n" -ForegroundColor Yellow

Start-Process notepad.exe $migrationFile
Start-Sleep -Seconds 1
Start-Process notepad.exe $functionFile

Write-Host "✅ Arquivos abertos no Notepad!" -ForegroundColor Green
Write-Host "   Agora é só copiar e colar no Dashboard conforme as instruções acima.`n" -ForegroundColor White

