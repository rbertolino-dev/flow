#!/bin/bash

# ============================================
# Aplicar Migration via Supabase CLI/psql
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/20251222190000_fix_onboarding_and_cadastro_errors.sql"

echo "🚀 Aplicando migration via CLI..."
echo ""

# Método 1: Tentar via Supabase CLI usando db execute (se disponível)
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI encontrado"
    
    # Verificar se está linkado
    if [ -f ".supabase/config.toml" ]; then
        echo "✅ Projeto linkado"
        
        # Tentar executar SQL diretamente via psql através do CLI
        echo "📤 Executando SQL via Supabase CLI..."
        
        # Ler SQL
        SQL_CONTENT=$(cat "$MIGRATION_FILE")
        
        # Executar via supabase db execute (se existir) ou usar método alternativo
        # Como db execute não existe, vamos usar uma edge function temporária
        
        echo "⚠️  Supabase CLI não tem comando direto para executar SQL"
        echo "📝 Criando edge function temporária para executar..."
        
        # Criar edge function temporária
        EDGE_FUNCTION_DIR="supabase/functions/execute-sql-temp"
        mkdir -p "$EDGE_FUNCTION_DIR"
        
        cat > "$EDGE_FUNCTION_DIR/index.ts" << 'EOF'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { sql } = await req.json();
    
    if (!sql) {
      return new Response(
        JSON.stringify({ error: 'SQL não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar SQL usando rpc (precisa de função no banco)
    // Como alternativa, vamos retornar instruções
    return new Response(
      JSON.stringify({ 
        message: 'Execute o SQL manualmente no Supabase SQL Editor',
        sql: sql.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
EOF

        echo "✅ Edge function criada (mas não é o método ideal)"
        echo ""
    fi
fi

# Método 2: Usar psql diretamente se tiver credenciais
if command -v psql &> /dev/null; then
    echo "✅ psql encontrado"
    
    # Tentar obter credenciais do Supabase
    if [ -f ".supabase/config.toml" ]; then
        DB_URL=$(grep -A 5 "\[db\]" .supabase/config.toml 2>/dev/null | grep "url" | cut -d '"' -f2 || echo "")
        
        if [ -n "$DB_URL" ]; then
            echo "📤 Executando migration via psql..."
            echo "$SQL_CONTENT" | psql "$DB_URL"
            
            if [ $? -eq 0 ]; then
                echo ""
                echo "✅ Migration aplicada com sucesso via psql!"
                exit 0
            fi
        fi
    fi
fi

# Método 3: Usar API REST do Supabase para executar SQL
echo "📤 Tentando via API REST do Supabase..."
echo ""

# Verificar se temos service role key
if [ -f ".env" ]; then
    SERVICE_ROLE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
    SUPABASE_URL=$(grep "VITE_SUPABASE_URL" .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs || echo "")
    
    if [ -n "$SERVICE_ROLE_KEY" ] && [ -n "$SUPABASE_URL" ]; then
        echo "✅ Credenciais encontradas"
        echo "📤 Executando via API REST..."
        
        # Ler SQL
        SQL_CONTENT=$(cat "$MIGRATION_FILE")
        
        # Executar via API (usando função RPC se existir)
        RESPONSE=$(curl -s -X POST \
            "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
            -H "apikey: ${SERVICE_ROLE_KEY}" \
            -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
            -H "Content-Type: application/json" \
            -d "{\"sql\": $(echo "$SQL_CONTENT" | jq -Rs .)}" 2>&1)
        
        if echo "$RESPONSE" | grep -q "success\|200"; then
            echo "✅ Migration aplicada via API!"
            exit 0
        else
            echo "⚠️  API não respondeu como esperado"
            echo "   Resposta: $RESPONSE"
        fi
    fi
fi

# Se nenhum método funcionou, mostrar instruções
echo ""
echo "=========================================="
echo "⚠️  Não foi possível aplicar automaticamente"
echo "=========================================="
echo ""
echo "📝 Execute manualmente no Supabase SQL Editor:"
echo "   1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
echo "   2. Cole o SQL abaixo:"
echo ""
echo "=========================================="
cat "$MIGRATION_FILE"
echo "=========================================="
echo ""

exit 1

