#!/bin/bash
# Script para acompanhar o progresso do script de marcar migrations

LOG_FILE="/tmp/marcar-migrations.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ACOMPANHAMENTO - MARCAR MIGRATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$LOG_FILE" ]; then
    echo "⏳ Script de marcar ainda não foi executado"
    echo ""
    echo "Para executar:"
    echo "  ./scripts/marcar-migrations-aplicadas.sh"
    exit 0
fi

# Verificar se está rodando
if ps aux | grep -q "[m]arcar-migrations-aplicadas"; then
    echo "✅ Script está RODANDO"
else
    echo "❌ Script NÃO está rodando"
fi

echo ""

# Estatísticas
TOTAL_REG=$(grep -c "✅.*registrada" "$LOG_FILE" 2>/dev/null || echo 0)
TOTAL_PULADAS=$(grep -c "já registrada" "$LOG_FILE" 2>/dev/null || echo 0)
TOTAL_ERROS=$(grep -c "Erro ao marcar" "$LOG_FILE" 2>/dev/null || echo 0)
TOTAL_MARCANDO=$(grep -c "📝 Marcando" "$LOG_FILE" 2>/dev/null || echo 0)

echo "📈 Estatísticas:"
echo "   ✅ Registradas: $TOTAL_REG"
echo "   ⏭️  Já registradas (puladas): $TOTAL_PULADAS"
echo "   ❌ Erros: $TOTAL_ERROS"
echo "   📝 Total processadas: $TOTAL_MARCANDO"
echo ""

# Última atualização
echo "⏱️  Última atualização:"
stat -c "%y" "$LOG_FILE" | cut -d. -f1
echo ""

# Comparação com banco
cd /root/kanban-buzz-95241 2>/dev/null || cd "$(dirname "$0")/.."
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

APPLIED_DB=$(supabase migration list 2>&1 | grep -E '^\s+[0-9]+\s+\|\s+[0-9]+\s+\|' | wc -l)
APPLIED_SCRIPT=$(grep -c "✅.*aplicada" /tmp/migration-inteligente-corrigido.log 2>/dev/null || echo 0)

echo "📊 Comparação:"
echo "   Aplicadas pelo script: $APPLIED_SCRIPT"
echo "   Registradas no banco: $APPLIED_DB"
echo "   Faltam registrar: $((APPLIED_SCRIPT - APPLIED_DB))"
echo ""

# Últimas ações
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ÚLTIMAS 15 AÇÕES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -15 "$LOG_FILE" | grep -E "(Marcando|registrada|já registrada|Erro|RESUMO)" || tail -15 "$LOG_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Para ver em tempo real:"
echo "   tail -f $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




