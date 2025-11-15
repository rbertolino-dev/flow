# Script para fazer deploy das funcoes Edge
# Execute: .\deploy-funcoes.ps1

Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  DEPLOY DAS FUNCOES EDGE' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''

# Verificar se Supabase CLI esta instalado
$supabaseCli = Get-Command supabase -ErrorAction SilentlyContinue

if ($supabaseCli) {
    Write-Host 'Supabase CLI encontrado!' -ForegroundColor Green
    Write-Host ''
    Write-Host 'Fazendo deploy das funcoes...' -ForegroundColor Yellow
    Write-Host ''
    
    # Deploy da funcao Asaas
    Write-Host '1. Deploy da funcao asaas-create-charge...' -ForegroundColor White
    supabase functions deploy asaas-create-charge
    if ($LASTEXITCODE -eq 0) {
        Write-Host '   OK!' -ForegroundColor Green
    } else {
        Write-Host '   ERRO!' -ForegroundColor Red
    }
    Write-Host ''
    
    # Deploy da funcao de workflows
    Write-Host '2. Deploy da funcao process-whatsapp-workflows...' -ForegroundColor White
    supabase functions deploy process-whatsapp-workflows
    if ($LASTEXITCODE -eq 0) {
        Write-Host '   OK!' -ForegroundColor Green
    } else {
        Write-Host '   ERRO!' -ForegroundColor Red
    }
    Write-Host ''
    
    Write-Host 'Deploy concluido!' -ForegroundColor Green
} else {
    Write-Host 'Supabase CLI nao encontrado.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '===========================================' -ForegroundColor Cyan
    Write-Host '  METODO ALTERNATIVO (Via Dashboard)' -ForegroundColor Yellow
    Write-Host '===========================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Siga estes passos:' -ForegroundColor Green
    Write-Host ''
    Write-Host '1. Acesse: https://supabase.com/dashboard' -ForegroundColor White
    Write-Host '2. Selecione seu projeto' -ForegroundColor White
    Write-Host '3. Va em Edge Functions' -ForegroundColor White
    Write-Host ''
    Write-Host 'Para a funcao asaas-create-charge:' -ForegroundColor Yellow
    Write-Host '  - Clique em Create a new function' -ForegroundColor White
    Write-Host '  - Nome: asaas-create-charge' -ForegroundColor White
    Write-Host '  - Abra: supabase/functions/asaas-create-charge/index.ts' -ForegroundColor White
    Write-Host '  - Copie todo o conteudo e cole no Dashboard' -ForegroundColor White
    Write-Host '  - Clique em Deploy' -ForegroundColor White
    Write-Host ''
    Write-Host 'Para a funcao process-whatsapp-workflows:' -ForegroundColor Yellow
    Write-Host '  - Encontre a funcao na lista' -ForegroundColor White
    Write-Host '  - Clique para editar' -ForegroundColor White
    Write-Host '  - Abra: supabase/functions/process-whatsapp-workflows/index.ts' -ForegroundColor White
    Write-Host '  - Substitua o conteudo antigo pelo novo' -ForegroundColor White
    Write-Host '  - Clique em Deploy' -ForegroundColor White
    Write-Host ''
    Write-Host '===========================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Pressione qualquer tecla para abrir o Dashboard...' -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
    Start-Process "https://supabase.com/dashboard/project/_/functions"
    
    Write-Host ''
    Write-Host 'Dashboard aberto!' -ForegroundColor Green
    Write-Host 'Siga as instrucoes acima para fazer o deploy manualmente.' -ForegroundColor Yellow
    Write-Host ''
}

