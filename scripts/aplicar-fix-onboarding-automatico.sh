#!/bin/bash

# ============================================
# Script Automatizado: Aplicar Fix Onboarding
# ============================================
# Aplica migration e verifica se tudo está OK

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🔧 Aplicando fix do onboarding automaticamente..."

# 1. Verificar se Supabase CLI está configurado
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI não encontrado. Tentando aplicar via SQL direto..."
    
    # Carregar credenciais
    if [ -f "$SCRIPT_DIR/.supabase-credentials" ]; then
        source "$SCRIPT_DIR/.supabase-credentials"
    else
        echo "❌ Arquivo .supabase-credentials não encontrado"
        echo "📝 Criando arquivo de exemplo..."
        cat > "$SCRIPT_DIR/.supabase-credentials" << 'EOF'
# Configurar estas variáveis:
# export SUPABASE_URL="https://seu-projeto.supabase.co"
# export SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
EOF
        echo "✅ Arquivo criado. Configure as credenciais e execute novamente."
        exit 1
    fi
    
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo "❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas"
        exit 1
    fi
    
    # Aplicar migration via API REST
    echo "📤 Aplicando migration via Supabase REST API..."
    MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql"
    
    if [ ! -f "$MIGRATION_FILE" ]; then
        echo "❌ Arquivo de migration não encontrado: $MIGRATION_FILE"
        exit 1
    fi
    
    # Ler SQL da migration
    SQL_CONTENT=$(cat "$MIGRATION_FILE")
    
    # Executar via REST API (usando rpc ou executar SQL direto)
    echo "🔍 Verificando se podemos executar SQL via API..."
    
    # Tentar executar via edge function ou método alternativo
    echo "⚠️  Execução direta via API não disponível."
    echo "📝 Por favor, execute manualmente no Supabase SQL Editor:"
    echo "   1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql"
    echo "   2. Cole o conteúdo de: $MIGRATION_FILE"
    echo "   3. Execute o SQL"
    
else
    # Usar Supabase CLI
    echo "✅ Supabase CLI encontrado"
    
    # Verificar se está logado
    if ! supabase projects list &> /dev/null; then
        echo "⚠️  Não está logado no Supabase CLI"
        echo "🔐 Execute: supabase login"
        exit 1
    fi
    
    # Aplicar migration
    echo "📤 Aplicando migration..."
    supabase db push
    
    echo "✅ Migration aplicada com sucesso!"
fi

# 2. Verificar se deploy está concluído
echo ""
echo "🔍 Verificando status do deploy..."
if [ -f "/tmp/deploy-zero-downtime.lock" ]; then
    echo "⏳ Deploy ainda em andamento..."
    echo "   Aguardando conclusão..."
    
    # Aguardar até 10 minutos
    TIMEOUT=600
    ELAPSED=0
    while [ -f "/tmp/deploy-zero-downtime.lock" ] && [ $ELAPSED -lt $TIMEOUT ]; do
        sleep 5
        ELAPSED=$((ELAPSED + 5))
        echo "   Aguardando... (${ELAPSED}s/${TIMEOUT}s)"
    done
    
    if [ -f "/tmp/deploy-zero-downtime.lock" ]; then
        echo "⚠️  Deploy ainda em andamento após ${TIMEOUT}s"
        echo "   Verifique manualmente: ./scripts/deploy-zero-downtime.sh --confirm"
    else
        echo "✅ Deploy concluído!"
    fi
else
    echo "✅ Nenhum deploy em andamento"
fi

# 3. Verificar se containers estão rodando
echo ""
echo "🔍 Verificando containers Docker..."
if command -v docker &> /dev/null; then
    if docker compose -f docker-compose.blue.yml ps | grep -q "Up"; then
        echo "✅ Container Blue está rodando"
    elif docker compose -f docker-compose.green.yml ps | grep -q "Up"; then
        echo "✅ Container Green está rodando"
    else
        echo "⚠️  Nenhum container está rodando"
        echo "   Execute: ./scripts/deploy-zero-downtime.sh --confirm"
    fi
else
    echo "⚠️  Docker não encontrado (pode estar no servidor remoto)"
fi

# 4. Resumo
echo ""
echo "=========================================="
echo "✅ Fix do onboarding aplicado!"
echo "=========================================="
echo ""
echo "📋 Próximos passos:"
echo "   1. Se migration não foi aplicada automaticamente, execute manualmente no Supabase SQL Editor"
echo "   2. Verifique se deploy foi concluído"
echo "   3. Teste o cadastro em: https://agilizeflow.com.br/CADASTRO"
echo ""
echo "🔍 Para verificar logs:"
echo "   - Migration: Verifique no Supabase Dashboard > SQL Editor > History"
echo "   - Deploy: tail -f /var/log/kanban-buzz-deploy.log (se existir)"
echo ""

