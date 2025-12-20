#!/bin/bash

# 📊 Script: Ver Deploys Incorretos
# Descrição: Mostra logs de tentativas de deploy incorreto
# Uso: ./scripts/ver-deploys-incorretos.sh

LOG_FILE="/var/log/kanban-buzz-deploy-protection.log"
ALERT_FILE="/var/log/kanban-buzz-deploy-alerts.log"

echo "🔍 Deploys Incorretos Detectados"
echo "================================="
echo ""

if [ ! -f "$ALERT_FILE" ]; then
    echo "✅ Nenhum deploy incorreto detectado ainda"
    echo ""
    echo "Arquivo de alertas: $ALERT_FILE"
    exit 0
fi

echo "📋 Últimos Alertas (últimas 20):"
echo "---------------------------------"
tail -20 "$ALERT_FILE" | while IFS= read -r line; do
    if echo "$line" | grep -q "🚨"; then
        echo -e "\033[1;31m$line\033[0m"
    else
        echo "$line"
    fi
done

echo ""
echo "📊 Estatísticas:"
echo "----------------"
total=$(wc -l < "$ALERT_FILE" 2>/dev/null || echo "0")
hoje=$(grep "$(date '+%Y-%m-%d')" "$ALERT_FILE" | wc -l)
echo "Total de alertas: $total"
echo "Alertas hoje: $hoje"

echo ""
echo "📁 Arquivos de log:"
echo "   - Alertas: $ALERT_FILE"
echo "   - Log completo: $LOG_FILE"
echo ""
echo "Para ver log completo:"
echo "   tail -f $LOG_FILE"
echo "   tail -f $ALERT_FILE"


