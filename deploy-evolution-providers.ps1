# Script de Deploy - Evolution Providers
# Execute no PowerShell: .\deploy-evolution-providers.ps1

Write-Host '🚀 Iniciando deploy do Evolution Providers...' -ForegroundColor Cyan
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
    
    # 1. Aplicar migrações
    Write-Host '📦 Aplicando migrações do banco de dados...' -ForegroundColor Yellow
    Write-Host '   Executando: supabase db push' -ForegroundColor White
    Write-Host ''
    
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host ''
        Write-Host '   ✅ Migrações aplicadas!' -ForegroundColor Green
    } else {
        Write-Host ''
        Write-Host '   ⚠️  Erro ao aplicar migrações via CLI' -ForegroundColor Yellow
        Write-Host '   📋 Aplique manualmente via Dashboard:' -ForegroundColor White
        Write-Host '      - SQL Editor > Cole o conteúdo de:' -ForegroundColor White
        Write-Host '        1. supabase/migrations/20250131000005_create_evolution_providers.sql' -ForegroundColor Green
        Write-Host '        2. supabase/migrations/20250131000006_secure_evolution_providers.sql' -ForegroundColor Green
        Write-Host ''
    }
} else {
    Write-Host '⚠️  Supabase CLI não encontrado.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '📋 Aplique as migrações manualmente via Dashboard:' -ForegroundColor White
    Write-Host '   1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix' -ForegroundColor Cyan
    Write-Host '   2. Vá em SQL Editor' -ForegroundColor White
    Write-Host '   3. Execute na ordem:' -ForegroundColor White
    Write-Host '      a) supabase/migrations/20250131000005_create_evolution_providers.sql' -ForegroundColor Green
    Write-Host '      b) supabase/migrations/20250131000006_secure_evolution_providers.sql' -ForegroundColor Green
    Write-Host ''
}

# 2. Build do frontend
Write-Host '🔨 Fazendo build do frontend...' -ForegroundColor Yellow
Write-Host ''

npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host ''
    Write-Host '✅ Build concluído!' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host '❌ Erro no build!' -ForegroundColor Red
    Write-Host '   Verifique os erros acima e corrija antes de continuar' -ForegroundColor Yellow
    exit 1
}

Write-Host ''
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host '  ✅ DEPLOY CONCLUÍDO!' -ForegroundColor Green
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '📋 Próximos passos:' -ForegroundColor Yellow
Write-Host ''
Write-Host '1. Verifique se as tabelas foram criadas:' -ForegroundColor White
Write-Host '   - Vá em Supabase Dashboard > Table Editor' -ForegroundColor Cyan
Write-Host '   - Deve aparecer: evolution_providers e organization_evolution_provider' -ForegroundColor White
Write-Host ''
Write-Host '2. Verifique se as funções RPC foram criadas:' -ForegroundColor White
Write-Host '   - Vá em Database > Functions' -ForegroundColor Cyan
Write-Host '   - Deve aparecer: get_organization_evolution_provider e organization_has_evolution_provider' -ForegroundColor White
Write-Host ''
Write-Host '3. Teste as funcionalidades:' -ForegroundColor White
Write-Host '   - Acesse como Super Admin' -ForegroundColor Cyan
Write-Host '   - Vá em Super Admin Dashboard > Providers Evolution' -ForegroundColor Cyan
Write-Host '   - Crie um provider de teste' -ForegroundColor White
Write-Host '   - Atribua a uma organização' -ForegroundColor White
Write-Host '   - Teste criar instância como usuário (não deve ver URL/API key)' -ForegroundColor White
Write-Host ''
Write-Host '📖 Para mais detalhes, consulte: DEPLOY-EVOLUTION-PROVIDERS.md' -ForegroundColor Cyan
Write-Host ''


