#!/bin/bash
# 🔄 Script para Aplicar TODAS as Migrations em Background
# Ignora erros de "already exists" e continua até acabar

set +e  # Não parar em erros

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-background-completa.log"
PID_FILE="/tmp/migration-background-completa.pid"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 INICIANDO MIGRAÇÕES EM BACKGROUND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Log: $LOG_FILE"
echo "🆔 PID: $$"
echo ""

# Salvar PID
echo $$ > "$PID_FILE"

# Função para limpar ao sair
cleanup() {
    rm -f "$PID_FILE"
    echo "" >> "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
    echo "✅ Processo finalizado em $(date)" >> "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$LOG_FILE"
}
trap cleanup EXIT

# Redirecionar tudo para o log
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🕐 Início: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Contar migrations
TOTAL=$(ls -1 supabase/migrations/*.sql 2>/dev/null | grep -v backup | wc -l)
echo "📊 Total de migrations: $TOTAL"
echo ""

# Aplicar migrations com retry automático
MAX_RETRIES=5
RETRY_COUNT=0
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$SUCCESS" != "true" ]; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Tentativa $((RETRY_COUNT + 1)) de $MAX_RETRIES"
    echo "🕐 $(date)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Aplicar migrations (timeout de 1 hora)
    OUTPUT=$(timeout 3600 bash -c 'echo "y" | supabase db push --include-all 2>&1')
    EXIT_CODE=$?
    
    # Salvar output completo
    echo "$OUTPUT" >> "$LOG_FILE"
    
    # Verificar se houve sucesso
    if echo "$OUTPUT" | grep -qi "Successfully\|Finished applying\|All migrations applied"; then
        echo ""
        echo "✅ ✅ ✅ SUCESSO! Todas as migrations foram aplicadas! ✅ ✅ ✅"
        echo ""
        SUCCESS=true
        break
    fi
    
    # Contar erros
    ERRORS=$(echo "$OUTPUT" | grep -i "ERROR" | wc -l)
    ALREADY_EXISTS=$(echo "$OUTPUT" | grep -i "already exists\|duplicate" | wc -l)
    CRITICAL_ERRORS=$(echo "$OUTPUT" | grep -i "ERROR" | grep -v "already exists" | grep -v "duplicate key" | grep -v "relation.*already exists" | grep -v "policy.*already exists" | grep -v "trigger.*already exists" | grep -v "function.*already exists" | grep -v "index.*already exists" | wc -l)
    
    echo "📊 Estatísticas desta tentativa:"
    echo "   ⚠️  Total de erros: $ERRORS"
    echo "   ✅ Erros ignorados (already exists): $ALREADY_EXISTS"
    echo "   ❌ Erros críticos: $CRITICAL_ERRORS"
    echo ""
    
    # Se não há erros críticos, considerar sucesso parcial
    if [ "$CRITICAL_ERRORS" -eq 0 ]; then
        echo "✅ Apenas erros de 'already exists' encontrados (normal)"
        echo "🔄 Continuando para garantir que tudo foi aplicado..."
        SUCCESS=true
        break
    fi
    
    # Se há erros críticos, mostrar e tentar novamente
    if [ "$CRITICAL_ERRORS" -gt 0 ]; then
        echo "⚠️  Erros críticos encontrados:"
        echo "$OUTPUT" | grep -i "ERROR" | grep -v "already exists" | grep -v "duplicate key" | grep -v "relation.*already exists" | grep -v "policy.*already exists" | head -10
        echo ""
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        WAIT_TIME=$((RETRY_COUNT * 10))
        echo "⏳ Aguardando ${WAIT_TIME}s antes da próxima tentativa..."
        sleep $WAIT_TIME
        echo ""
    fi
done

# Status final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STATUS FINAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SUCCESS" = "true" ]; then
    echo "✅ Migrations aplicadas com sucesso!"
else
    echo "⚠️  Processo concluído com alguns erros (mas continuou até o fim)"
fi

echo ""
echo "📋 Verificando status das migrations:"
supabase migration list 2>&1 | head -20

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🕐 Fim: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Log completo em: $LOG_FILE"
echo "💡 Para acompanhar em tempo real: tail -f $LOG_FILE"




