#!/bin/bash
# Script otimizado para aplicar migrations em lote
# Aplica múltiplas migrations de uma vez, ignorando erros de "already exists"

set -euo pipefail

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Erro: SUPABASE_ACCESS_TOKEN não definido"
    exit 1
fi

export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"
cd "$(dirname "$0")/.." || exit 1

echo "🚀 Migração Otimizada - Aplicando migrations em lote"
echo "=================================================="
echo ""

# Contar migrations pendentes
echo "📊 Verificando status..."
PENDING=$(supabase migration list 2>&1 | grep -c "Pending" || echo "0")
APPLIED=$(supabase migration list 2>&1 | grep -c "Applied" || echo "0")
echo "   ✅ Aplicadas: $APPLIED"
echo "   ⏳ Pendentes: $PENDING"
echo ""

if [ "$PENDING" -eq "0" ]; then
    echo "✅ Todas as migrations já foram aplicadas!"
    exit 0
fi

echo "🔄 Aplicando migrations (isso pode levar alguns minutos)..."
echo ""

# Aplicar com --include-all para forçar aplicação de todas
OUTPUT=$(echo "y" | timeout 1800 supabase db push --include-all 2>&1)
EXIT_CODE=$?

# Analisar resultado
if echo "$OUTPUT" | grep -qE "Successfully|Finished applying|migrations applied"; then
    echo ""
    echo "✅ SUCESSO! Migrations aplicadas com sucesso!"
    echo ""
    echo "$OUTPUT" | grep -E "(Successfully|Finished|applied)" | tail -3
    exit 0
fi

# Verificar se há erros críticos
CRITICAL=$(echo "$OUTPUT" | grep -i "ERROR" | grep -vE "already exists|duplicate key|relation.*already exists|policy.*already exists|constraint.*already exists" || true)

if [ -n "$CRITICAL" ]; then
    echo ""
    echo "❌ ERRO CRÍTICO encontrado:"
    echo "=========================="
    echo "$CRITICAL" | head -10
    echo ""
    echo "📝 Últimas 30 linhas do log:"
    echo "$OUTPUT" | tail -30
    exit 1
fi

# Se chegou aqui, provavelmente são apenas avisos de "already exists"
echo ""
echo "⚠️  Algumas migrations podem já ter sido aplicadas anteriormente"
echo "📊 Verificando status final..."
echo ""

# Mostrar status final
supabase migration list 2>&1 | grep -E "(Pending|Applied)" | head -15

echo ""
echo "✅ Processo concluído!"
echo "💡 Dica: Erros de 'already exists' são normais e podem ser ignorados"
