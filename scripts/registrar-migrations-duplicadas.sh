#!/bin/bash
# Script para registrar migrations duplicadas que foram aplicadas mas não registradas

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
LOG_FILE="/tmp/registrar-duplicadas.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

cd /root/kanban-buzz-95241 || exit 1

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📝 Registrando migrations aplicadas mas não registradas"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Migrations não registradas (sem duplicata)
MIGRATIONS_NAO_REGISTRADAS=(
    "20251107142430"
    "20251108125748"
)

TOTAL=0
SUCESSO=0
FALHAS=0

log "📊 Total de migrations não registradas: ${#MIGRATIONS_NAO_REGISTRADAS[@]}"
log ""

# Registrar migrations não registradas
log "🔄 Processando migrations não registradas..."
for timestamp in "${MIGRATIONS_NAO_REGISTRADAS[@]}"; do
    TOTAL=$((TOTAL + 1))
    
    log "📝 Registrando $timestamp..."
    
    OUTPUT=$(supabase migration repair --status applied "$timestamp" 2>&1)
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "Successfully|Applied|already"; then
        log "   ✅ $timestamp registrada!"
        SUCESSO=$((SUCESSO + 1))
    else
        log "   ❌ Erro ao registrar $timestamp: $OUTPUT"
        FALHAS=$((FALHAS + 1))
    fi
    
    sleep 2
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO:"
log "   ✅ Registradas: $SUCESSO"
log "   ❌ Falhas: $FALHAS"
log "   📊 Total: $TOTAL"
log ""
log "⚠️  NOTA: Migrations duplicadas não podem ser registradas"
log "   com o mesmo timestamp. Elas foram APLICADAS (SQL executado),"
log "   mas apenas uma de cada timestamp foi registrada."
log "   Isso é normal e não afeta o funcionamento do banco."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"



