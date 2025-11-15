# Script para aplicar todas as migrações no Supabase
# Execute: .\aplicar-migracoes-supabase.ps1

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  APLICAR MIGRAÇÕES NO SUPABASE' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''

# Verificar se está no diretório correto
if (-not (Test-Path "supabase")) {
    Write-Host '❌ Erro: Execute este script na raiz do projeto (agilize/)' -ForegroundColor Red
    exit 1
}

Write-Host '📋 Migrações que serão aplicadas:' -ForegroundColor Yellow
Write-Host '  1. Grupos de WhatsApp (whatsapp_workflow_groups)' -ForegroundColor White
Write-Host '  2. Anexos por mês (month_reference)' -ForegroundColor White
Write-Host '  3. Suporte a grupos em workflows' -ForegroundColor White
Write-Host '  4. Integração Asaas (asaas_configs)' -ForegroundColor White
Write-Host ''

# Tentar usar Supabase CLI se disponível
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabaseCli) {
    Write-Host '✅ Supabase CLI encontrado!' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Aplicando migrações via CLI...' -ForegroundColor Yellow
    Write-Host ''
    
    try {
        supabase db push
        if ($LASTEXITCODE -eq 0) {
            Write-Host ''
            Write-Host '✅ Migrações aplicadas com sucesso via CLI!' -ForegroundColor Green
            Write-Host ''
            Write-Host 'Próximos passos:' -ForegroundColor Cyan
            Write-Host '  1. Verifique as tabelas no Dashboard > Table Editor' -ForegroundColor White
            Write-Host '  2. Faça deploy da função: supabase functions deploy asaas-create-charge' -ForegroundColor White
            Write-Host '  3. Faça deploy da função: supabase functions deploy process-whatsapp-workflows' -ForegroundColor White
            exit 0
        } else {
            Write-Host '⚠️  CLI retornou erro. Use o método manual abaixo.' -ForegroundColor Yellow
        }
    } catch {
        Write-Host '⚠️  Erro ao usar CLI. Use o método manual abaixo.' -ForegroundColor Yellow
    }
} else {
    Write-Host '⚠️  Supabase CLI não encontrado.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  MÉTODO MANUAL (Via Dashboard)' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Siga estes passos:' -ForegroundColor Green
Write-Host ''
Write-Host '1. Abra o arquivo: aplicar-todas-migracoes.sql' -ForegroundColor White
Write-Host '2. Copie TODO o conteúdo do arquivo' -ForegroundColor White
Write-Host '3. Acesse: https://supabase.com/dashboard' -ForegroundColor White
Write-Host '4. Selecione seu projeto' -ForegroundColor White
Write-Host '5. Vá em SQL Editor (menu lateral)' -ForegroundColor White
Write-Host '6. Cole o conteúdo copiado' -ForegroundColor White
Write-Host '7. Clique em RUN ou pressione Ctrl+Enter' -ForegroundColor White
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  Verificações após aplicar:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'No Dashboard, verifique se as tabelas foram criadas:' -ForegroundColor White
Write-Host '  ✓ whatsapp_workflow_groups' -ForegroundColor Gray
Write-Host '  ✓ asaas_configs' -ForegroundColor Gray
Write-Host ''
Write-Host 'Verifique se as colunas foram adicionadas:' -ForegroundColor White
Write-Host '  ✓ whatsapp_workflow_contact_attachments.month_reference' -ForegroundColor Gray
Write-Host '  ✓ whatsapp_workflows.recipient_type' -ForegroundColor Gray
Write-Host '  ✓ whatsapp_workflows.group_id' -ForegroundColor Gray
Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  Próximos passos após migrações:' -ForegroundColor Yellow
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '1. Deploy da função Asaas:' -ForegroundColor White
Write-Host '   supabase functions deploy asaas-create-charge' -ForegroundColor Gray
Write-Host ''
Write-Host '2. Deploy da função de workflows:' -ForegroundColor White
Write-Host '   supabase functions deploy process-whatsapp-workflows' -ForegroundColor Gray
Write-Host ''
Write-Host '✅ Pronto! Siga as instruções acima para aplicar as migrações.' -ForegroundColor Green
Write-Host ''

