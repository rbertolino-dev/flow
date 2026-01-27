#!/bin/bash

# ============================================
# Aplicar Disparador 2 Completo com Correção RLS
# ============================================
# Aplica migrations na ordem correta:
# 1. Cria tabelas (20260129000001_create_broadcast_system_2.sql)
# 2. Corrige RLS (20260127000001_fix_broadcast_campaigns_2_rls.sql)
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "╔════════════════════════════════════════╗"
echo "║  Aplicar Disparador 2 Completo         ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "📁 Diretório: $PROJECT_DIR"
echo ""

# Carregar credenciais SSH
if [ -f "$SCRIPT_DIR/.ssh-credentials" ]; then
  source "$SCRIPT_DIR/.ssh-credentials"
else
  echo "❌ Arquivo .ssh-credentials não encontrado"
  exit 1
fi

# Verificar se Supabase CLI está configurado
if [ ! -f "$PROJECT_DIR/.supabase/config.toml" ]; then
  echo "⚠️  Supabase CLI não está configurado localmente"
  echo "📋 Aplicando migrations via SQL direto no servidor..."
  
  # Aplicar via SQL direto no servidor
  echo ""
  echo "🔧 Aplicando migration 1/2: Criar tabelas..."
  ssh kanban-buzz-server "cd /opt/app && psql \$DATABASE_URL -f -" < "$PROJECT_DIR/supabase/migrations/20260129000001_create_broadcast_system_2.sql"
  
  echo ""
  echo "🔧 Aplicando migration 2/2: Corrigir RLS..."
  ssh kanban-buzz-server "cd /opt/app && psql \$DATABASE_URL -f -" < "$PROJECT_DIR/supabase/migrations/20260127000001_fix_broadcast_campaigns_2_rls.sql"
  
  echo ""
  echo "✅ Migrations aplicadas com sucesso!"
else
  echo "🔧 Aplicando migrations via Supabase CLI..."
  
  # Aplicar migrations na ordem
  echo ""
  echo "🔧 Aplicando migration 1/2: Criar tabelas..."
  supabase db push --include-all
  
  echo ""
  echo "✅ Migrations aplicadas com sucesso!"
fi

echo ""
echo "📋 Verificando se tabelas foram criadas..."
ssh kanban-buzz-server "cd /opt/app && psql \$DATABASE_URL -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('broadcast_campaigns_2', 'broadcast_queue_2');\""

echo ""
echo "✅ Disparador 2 configurado completamente!"
