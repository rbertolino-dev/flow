#!/bin/bash
# Script para adicionar código de limpeza de policies no início de cada lote

cd "$(dirname "$0")/.." || exit 1

echo "🔧 Adicionando limpeza de policies nos lotes..."
echo ""

CLEANUP_SQL='
-- ============================================
-- LIMPEZA DE POLICIES DUPLICADAS
-- Remove policies que podem causar conflito
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Remover policies específicas conhecidas que causam erro
    DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
    DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
    DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
    DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;
    
    -- Remover policies duplicadas de forma genérica (apenas se necessário)
    -- Descomente a linha abaixo se ainda houver muitos erros
    -- FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    --     EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    -- END LOOP;
END $$;
'

# Adicionar no início de cada lote
for lote in migrations-lotes/lote-*.sql; do
    if [ -f "$lote" ]; then
        # Verificar se já tem o cleanup
        if ! grep -q "LIMPEZA DE POLICIES DUPLICADAS" "$lote"; then
            # Criar arquivo temporário com cleanup + conteúdo original
            TEMP=$(mktemp)
            echo "$CLEANUP_SQL" > "$TEMP"
            echo "" >> "$TEMP"
            cat "$lote" >> "$TEMP"
            mv "$TEMP" "$lote"
            echo "  ✅ $(basename $lote): Cleanup adicionado"
        fi
    fi
done

echo ""
echo "✅ Cleanup adicionado em todos os lotes!"




