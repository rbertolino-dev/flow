#!/bin/bash

# Script para aplicar migration que permite DELETE em broadcast_campaigns
# Execute este script para aplicar a migration no Supabase

echo "🔧 Aplicando migration para permitir DELETE em broadcast_campaigns..."

# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado. Instale com: npm install -g supabase"
    exit 1
fi

# Aplicar migration
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration aplicada com sucesso!"
    echo ""
    echo "Agora você pode excluir campanhas canceladas no frontend."
else
    echo "❌ Erro ao aplicar migration."
    echo ""
    echo "Alternativa: Execute o SQL manualmente no Supabase SQL Editor:"
    echo "  Arquivo: supabase/migrations/20260107000001_fix_broadcast_campaigns_delete_rls.sql"
    exit 1
fi


