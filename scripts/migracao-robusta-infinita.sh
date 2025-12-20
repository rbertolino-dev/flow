#!/bin/bash
# 🔄 Script Robusto para Aplicar TODAS as Migrations
# Continua tentando indefinidamente, mesmo com erros
# Ignora erros de "already exists" e continua até acabar

set +e  # NUNCA parar em erros

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-robusta-infinita.log"
PID_FILE="/tmp/migration-robusta-infinita.pid"
STATUS_FILE="/tmp/migration-robusta-status.txt"

# Função para log com timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Função para limpar ao sair
cleanup() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "🛑 Processo interrompido em $(date)"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

# Salvar PID
echo $$ > "$PID_FILE"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 INICIANDO MIGRAÇÃO ROBUSTA (LOOP INFINITO)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "📝 Log: $LOG_FILE"
log "🆔 PID: $$"
log ""

# Contar migrations
TOTAL=$(ls -1 supabase/migrations/*.sql 2>/dev/null | grep -v backup | wc -l)
log "📊 Total de migrations: $TOTAL"
log ""

# Variáveis de controle
ATTEMPT=0
MAX_ATTEMPTS=999999  # Praticamente infinito
SUCCESS_COUNT=0
FAIL_COUNT=0
LAST_APPLIED=0
STUCK_COUNT=0

# Função para verificar progresso
check_progress() {
    export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
    APPLIED=$(supabase migration list 2>&1 | grep -E '^\s+[0-9]+\s+\|\s+[0-9]+\s+\|' | wc -l 2>/dev/null || echo "0")
    PENDING=$(supabase migration list 2>&1 | grep -E '^\s+[0-9]+\s+\|\s+\s+\|' | wc -l 2>/dev/null || echo "0")
    
    echo "$APPLIED|$PENDING" > "$STATUS_FILE"
    echo "$APPLIED|$PENDING"
}

# Loop principal - TENTA INDEFINIDAMENTE
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    log ""
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log "📦 TENTATIVA #$ATTEMPT"
    log "🕐 $(date)"
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log ""
    
    # Verificar progresso antes
    PROGRESS_BEFORE=$(check_progress)
    APPLIED_BEFORE=$(echo "$PROGRESS_BEFORE" | cut -d'|' -f1)
    PENDING_BEFORE=$(echo "$PROGRESS_BEFORE" | cut -d'|' -f2)
    
    log "📊 Status antes: $APPLIED_BEFORE aplicadas, $PENDING_BEFORE pendentes"
    log ""
    
    # Aplicar migrations (timeout de 2 horas)
    log "🔄 Aplicando migrations..."
    OUTPUT=$(timeout 7200 bash -c 'echo "y" | supabase db push --include-all 2>&1')
    EXIT_CODE=$?
    
    # Salvar output completo
    log "$OUTPUT"
    
    # Verificar progresso depois
    PROGRESS_AFTER=$(check_progress)
    APPLIED_AFTER=$(echo "$PROGRESS_AFTER" | cut -d'|' -f1)
    PENDING_AFTER=$(echo "$PROGRESS_AFTER" | cut -d'|' -f2)
    
    log ""
    log "📊 Status depois: $APPLIED_AFTER aplicadas, $PENDING_AFTER pendentes"
    
    # Verificar se houve progresso
    if [ "$APPLIED_AFTER" -gt "$APPLIED_BEFORE" ]; then
        NEW_APPLIED=$((APPLIED_AFTER - APPLIED_BEFORE))
        log "✅ PROGRESSO! $NEW_APPLIED novas migrations aplicadas!"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        STUCK_COUNT=0
        LAST_APPLIED=$APPLIED_AFTER
    else
        STUCK_COUNT=$((STUCK_COUNT + 1))
        log "⚠️  Nenhum progresso nesta tentativa (stuck: $STUCK_COUNT)"
    fi
    
    # Contar erros
    ERRORS=$(echo "$OUTPUT" | grep -i "ERROR" | wc -l)
    ALREADY_EXISTS=$(echo "$OUTPUT" | grep -iE "already exists|duplicate|relation.*already exists|policy.*already exists|trigger.*already exists|function.*already exists|index.*already exists" | wc -l)
    
    # Erros críticos (não relacionados a "already exists")
    CRITICAL_ERRORS=$(echo "$OUTPUT" | grep -i "ERROR" | grep -v -iE "already exists|duplicate|relation.*already exists|policy.*already exists|trigger.*already exists|function.*already exists|index.*already exists|authentication failed|connection" | wc -l)
    
    log ""
    log "📊 Estatísticas desta tentativa:"
    log "   ⚠️  Total de erros: $ERRORS"
    log "   ✅ Erros ignorados (already exists): $ALREADY_EXISTS"
    log "   ❌ Erros críticos: $CRITICAL_ERRORS"
    log ""
    
    # Verificar se todas foram aplicadas
    if [ "$PENDING_AFTER" -eq 0 ] && [ "$APPLIED_AFTER" -gt 0 ]; then
        log ""
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log "🎉 🎉 🎉 SUCESSO COMPLETO! 🎉 🎉 🎉"
        log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        log ""
        log "✅ Todas as $APPLIED_AFTER migrations foram aplicadas!"
        log "📊 Total de tentativas: $ATTEMPT"
        log "✅ Tentativas com sucesso: $SUCCESS_COUNT"
        log ""
        exit 0
    fi
    
    # Se ficou preso por muitas tentativas, pausar mais tempo
    if [ $STUCK_COUNT -ge 10 ]; then
        WAIT_TIME=300  # 5 minutos
        log "⚠️  Preso há $STUCK_COUNT tentativas. Pausando por ${WAIT_TIME}s..."
    elif [ $STUCK_COUNT -ge 5 ]; then
        WAIT_TIME=120  # 2 minutos
        log "⚠️  Sem progresso há $STUCK_COUNT tentativas. Pausando por ${WAIT_TIME}s..."
    else
        WAIT_TIME=30  # 30 segundos
        log "⏳ Aguardando ${WAIT_TIME}s antes da próxima tentativa..."
    fi
    
    # Se há erros críticos mas não muitos, continuar mesmo assim
    if [ "$CRITICAL_ERRORS" -gt 0 ] && [ "$CRITICAL_ERRORS" -lt 5 ]; then
        log "⚠️  Erros críticos detectados, mas continuando..."
        log "   (Erros podem ser temporários ou já resolvidos)"
    fi
    
    # Pausar antes da próxima tentativa
    sleep $WAIT_TIME
    
    # Atualizar status
    log ""
    log "📈 Estatísticas gerais:"
    log "   ✅ Tentativas com sucesso: $SUCCESS_COUNT"
    log "   ⚠️  Tentativas sem progresso: $STUCK_COUNT"
    log "   📊 Últimas migrations aplicadas: $LAST_APPLIED"
    log ""
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🛑 Loop máximo atingido (não deveria acontecer)"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




