#!/bin/bash
# Script para acompanhar a migração em tempo real

LOG_FILE="/tmp/migration-robusta-infinita.log"
STATUS_FILE="/tmp/migration-robusta-status.txt"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 ACOMPANHAMENTO DA MIGRAÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar se está rodando
if ps aux | grep -q "[m]igracao-robusta-infinita"; then
    echo "✅ Processo está RODANDO"
else
    echo "❌ Processo NÃO está rodando"
fi

echo ""

# Status atual
if [ -f "$STATUS_FILE" ]; then
    STATUS=$(cat "$STATUS_FILE")
    APPLIED=$(echo "$STATUS" | cut -d'|' -f1)
    PENDING=$(echo "$STATUS" | cut -d'|' -f2)
    TOTAL=$((APPLIED + PENDING))
    PERCENT=$((APPLIED * 100 / TOTAL))
    
    echo "📊 Status Atual:"
    echo "   ✅ Aplicadas: $APPLIED de $TOTAL ($PERCENT%)"
    echo "   ⏳ Pendentes: $PENDING"
else
    echo "📊 Status: Aguardando primeira atualização..."
fi

echo ""

# Estatísticas do log
if [ -f "$LOG_FILE" ]; then
    ATTEMPTS=$(grep -c "TENTATIVA" "$LOG_FILE" 2>/dev/null || echo "0")
    PROGRESS=$(grep -c "PROGRESSO" "$LOG_FILE" 2>/dev/null || echo "0")
    ERRORS=$(grep -ci "ERROR" "$LOG_FILE" 2>/dev/null || echo "0")
    ALREADY_EXISTS=$(grep -ciE "already exists|duplicate" "$LOG_FILE" 2>/dev/null || echo "0")
    
    echo "📈 Estatísticas:"
    echo "   🔄 Tentativas: $ATTEMPTS"
    echo "   ✅ Progressos: $PROGRESS"
    echo "   ⚠️  Erros: $ERRORS"
    echo "   ✅ Ignorados (already exists): $ALREADY_EXISTS"
    echo ""
    echo "⏱️  Última atualização:"
    stat -c "%y" "$LOG_FILE" 2>/dev/null | cut -d. -f1 || echo "N/A"
else
    echo "⚠️  Log ainda não criado"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Comandos úteis:"
echo ""
echo "Ver log em tempo real:"
echo "  tail -f $LOG_FILE"
echo ""
echo "Ver últimas 50 linhas:"
echo "  tail -50 $LOG_FILE"
echo ""
echo "Ver apenas progressos:"
echo "  grep PROGRESSO $LOG_FILE | tail -10"
echo ""
echo "Ver tentativas:"
echo "  grep TENTATIVA $LOG_FILE | tail -10"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




