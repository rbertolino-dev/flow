#!/bin/bash
# Script para marcar migrations aplicadas como registradas no banco

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/marcar-migrations.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📝 Marcando migrations aplicadas como registradas"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Extrair todas as migrations que foram aplicadas
MIGRATIONS_APLICADAS=$(grep "✅.*aplicada" /tmp/migration-inteligente-corrigido.log 2>/dev/null | sed 's/.*✅ //' | sed 's/ aplicada.*//' | sed 's/.*\///' | sort -u)

TOTAL=$(echo "$MIGRATIONS_APLICADAS" | wc -l)
log "📊 Total de migrations para marcar: $TOTAL"
log ""

APPLIED=0
FAILED=0
SKIPPED=0

for mig_name in $MIGRATIONS_APLICADAS; do
    version=$(echo "$mig_name" | cut -d'_' -f1)
    
    # Verificar se já está registrada
    if supabase migration list 2>&1 | grep -qE "^\s+${version}\s+\|\s+${version}\s+\|"; then
        log "⏭️  $version já registrada (pulando)"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Marcar como aplicada
    log "📝 Marcando $version..."
    OUTPUT=$(supabase migration repair --status applied "$version" 2>&1)
    
    if echo "$OUTPUT" | grep -qi "Repaired\|Finished"; then
        log "✅ $version registrada!"
        APPLIED=$((APPLIED + 1))
    else
        ERROR=$(echo "$OUTPUT" | grep -i "error\|failed" | head -1)
        if [ -n "$ERROR" ]; then
            log "❌ Erro ao marcar $version: $ERROR"
        else
            log "⚠️  $version: resultado desconhecido"
        fi
        FAILED=$((FAILED + 1))
    fi
    
    # Pausa para não sobrecarregar
    sleep 1
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO:"
log "   ✅ Registradas: $APPLIED"
log "   ⏭️  Já registradas: $SKIPPED"
log "   ❌ Falhas: $FAILED"
log "   📊 Total: $TOTAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




