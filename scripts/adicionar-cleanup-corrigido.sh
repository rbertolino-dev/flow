#!/bin/bash
# Script corrigido para adicionar cleanup de policies

cd "$(dirname "$0")/.." || exit 1

CLEANUP_SQL='-- ============================================
-- LIMPEZA DE POLICIES DUPLICADAS
-- ============================================
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;
'

echo "🔧 Adicionando cleanup de policies nos lotes..."
echo ""

for lote in migrations-lotes/lote-*.sql; do
    if [ -f "$lote" ]; then
        if ! grep -q "LIMPEZA DE POLICIES DUPLICADAS" "$lote"; then
            TEMP=$(mktemp)
            # Manter o cabeçalho original (primeiras 5 linhas)
            head -5 "$lote" > "$TEMP"
            echo "" >> "$TEMP"
            echo "$CLEANUP_SQL" >> "$TEMP"
            echo "" >> "$TEMP"
            # Adicionar resto do arquivo (pular cabeçalho)
            tail -n +6 "$lote" >> "$TEMP"
            mv "$TEMP" "$lote"
            echo "  ✅ $(basename $lote): Cleanup adicionado"
        fi
    fi
done

echo ""
echo "✅ Pronto!"




