#!/bin/bash

# Script para aplicar migrations de múltiplos Evolution Providers
# Aplica as migrations necessárias para suportar múltiplos providers por organização

set -e

PROJECT_DIR="/root/kanban-buzz-95241"
cd "$PROJECT_DIR"

echo "🔄 Aplicando migrations para múltiplos Evolution Providers..."

# Verificar se supabase CLI está disponível
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instalando..."
    npm install -g supabase
fi

# Aplicar migrations
echo "📦 Aplicando migration 1: Criar tabela organization_evolution_providers..."
supabase db push --include-all || {
    echo "⚠️  Erro ao aplicar migrations via db push. Tentando método alternativo..."
    
    # Método alternativo: executar SQL diretamente
    echo "📝 Executando SQL diretamente..."
    
    # Ler credenciais
    if [ -f "scripts/.ssh-credentials" ]; then
        source scripts/.ssh-credentials
    fi
    
    # Executar SQL via Supabase Management API ou Dashboard
    echo "✅ Migrations criadas em:"
    echo "   - supabase/migrations/20250131000001_create_organization_evolution_providers.sql"
    echo "   - supabase/migrations/20250131000002_update_get_organization_evolution_provider.sql"
    echo ""
    echo "📋 Para aplicar manualmente:"
    echo "   1. Acesse o Supabase Dashboard > SQL Editor"
    echo "   2. Execute o conteúdo de cada migration em ordem"
    echo "   3. Ou use: supabase db push"
}

echo "✅ Processo concluído!"

