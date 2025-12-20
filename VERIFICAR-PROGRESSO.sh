#!/bin/bash
# Script para verificar progresso das migrations

export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

echo "📊 Status das Migrations"
echo "========================"
echo ""

# Contar migrations aplicadas (com Remote preenchido)
APPLIED=$(supabase migration list 2>&1 | grep -E "[0-9]{14}.*\|[[:space:]]*[0-9]{14}" | wc -l)

# Contar migrations pendentes (sem Remote)
PENDING=$(supabase migration list 2>&1 | grep -E "[0-9]{14}.*\|[[:space:]]*\|" | wc -l)

TOTAL=$((APPLIED + PENDING))

echo "✅ Aplicadas: $APPLIED"
echo "⏳ Pendentes: $PENDING"
echo "📊 Total: $TOTAL"
echo ""

if [ "$TOTAL" -gt 0 ]; then
    PERCENT=$((APPLIED * 100 / TOTAL))
    echo "📈 Progresso: $PERCENT%"
    echo ""
fi

# Mostrar últimas 10 migrations
echo "📋 Últimas migrations:"
supabase migration list 2>&1 | tail -12 | head -10

echo ""
echo "💡 Para ver progresso em tempo real:"
echo "   tail -f /tmp/migration-final-v8.log"
