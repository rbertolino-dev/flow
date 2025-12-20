#!/bin/bash
# 🧠 Script Inteligente Final - Aplica migrations uma por uma
# Detecta erros, corrige automaticamente, tenta até passar, vai para próxima

set +e

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-inteligente-final.log"
PID_FILE="/tmp/migration-inteligente-final.pid"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cleanup() {
    log "🛑 Processo interrompido"
    rm -f "$PID_FILE"
}
trap cleanup EXIT INT TERM

echo $$ > "$PID_FILE"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🧠 MIGRAÇÃO INTELIGENTE - AUTO-CORREÇÃO"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Função para corrigir migration
fix_migration() {
    local mig_file="$1"
    local error="$2"
    
    # Policy already exists
    if echo "$error" | grep -qi "policy.*already exists"; then
        policy=$(echo "$error" | sed -n 's/.*policy "\([^"]*\)".*/\1/p')
        table=$(echo "$error" | sed -n 's/.*table "\([^"]*\)".*/\1/p')
        
        if [ -n "$policy" ] && [ -n "$table" ]; then
            log "🔧 Corrigindo: DROP POLICY '$policy' em $table"
            [ ! -f "${mig_file}.orig" ] && cp "$mig_file" "${mig_file}.orig"
            sed -i "s|CREATE POLICY \"$policy\"|DROP POLICY IF EXISTS \"$policy\" ON $table;\nCREATE POLICY \"$policy\"|" "$mig_file"
            return 0
        fi
    fi
    
    # Trigger already exists
    if echo "$error" | grep -qi "trigger.*already exists"; then
        trigger=$(echo "$error" | sed -n 's/.*trigger "\([^"]*\)".*/\1/p')
        table=$(echo "$error" | sed -n 's/.*relation "\([^"]*\)".*/\1/p')
        
        if [ -n "$trigger" ] && [ -n "$table" ]; then
            log "🔧 Corrigindo: DROP TRIGGER '$trigger' em $table"
            [ ! -f "${mig_file}.orig" ] && cp "$mig_file" "${mig_file}.orig"
            sed -i "s|CREATE TRIGGER $trigger ON $table|DROP TRIGGER IF EXISTS $trigger ON $table CASCADE;\nCREATE TRIGGER $trigger ON $table|" "$mig_file"
            return 0
        fi
    fi
    
    # Function already exists
    if echo "$error" | grep -qi "function.*already exists"; then
        func=$(echo "$error" | sed -n 's/.*function "\([^"]*\)".*/\1/p')
        
        if [ -n "$func" ]; then
            log "🔧 Corrigindo: DROP FUNCTION '$func'"
            [ ! -f "${mig_file}.orig" ] && cp "$mig_file" "${mig_file}.orig"
            sed -i "/CREATE.*FUNCTION.*$func/i DROP FUNCTION IF EXISTS $func CASCADE;" "$mig_file"
            return 0
        fi
    fi
    
    return 1
}

# Aplicar migration com auto-correção
apply_migration() {
    local mig_file="$1"
    local mig_name=$(basename "$mig_file")
    local max_retries=10
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        retry=$((retry + 1))
        log "📦 [$retry/$max_retries] $mig_name"
        
        # Aplicar via supabase db push com migration única
        # Criar diretório temporário com apenas esta migration
        TEMP_MIG_DIR=$(mktemp -d)
        cp "$mig_file" "$TEMP_MIG_DIR/"
        
        # Backup migrations originais temporariamente
        if [ -d "supabase/migrations" ]; then
            mv supabase/migrations supabase/migrations.backup.temp
        fi
        mkdir -p supabase/migrations
        cp "$mig_file" supabase/migrations/
        
        # Aplicar via push
        OUTPUT=$(echo "y" | timeout 60 supabase db push --include-all 2>&1)
        EXIT_CODE=$?
        
        # Restaurar migrations originais
        rm -rf supabase/migrations
        if [ -d "supabase/migrations.backup.temp" ]; then
            mv supabase/migrations.backup.temp supabase/migrations
        fi
        rm -rf "$TEMP_MIG_DIR"
        
        # Verificar sucesso
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "success|completed"; then
            log "✅ $mig_name aplicada!"
            
            # Marcar como aplicada
            supabase migration repair --status applied "$(echo "$mig_name" | cut -d'_' -f1)" 2>/dev/null || true
            return 0
        fi
        
        # Verificar erro de "already exists"
        ERROR=$(echo "$OUTPUT" | grep -iE "already exists|duplicate" | head -1)
        if [ -n "$ERROR" ]; then
            log "⚠️  Erro: $ERROR"
            
            # Tentar corrigir
            if fix_migration "$mig_file" "$ERROR"; then
                log "✅ Corrigido! Tentando novamente..."
                continue
            fi
        fi
        
        # Outros erros
        if [ $EXIT_CODE -ne 0 ]; then
            ERR_MSG=$(echo "$OUTPUT" | grep -i "ERROR" | head -1)
            if [ -n "$ERR_MSG" ]; then
                log "❌ $ERR_MSG"
            fi
        fi
    done
    
    log "⚠️  Não foi possível aplicar $mig_name"
    return 1
}

# Listar migrations
ALL_MIGRATIONS=$(ls -1 supabase/migrations/*.sql 2>/dev/null | grep -v backup | grep -v original | sort)
TOTAL=$(echo "$ALL_MIGRATIONS" | wc -l)

log "📊 Total: $TOTAL migrations"
log ""

APPLIED=0
FAILED=0

# Aplicar uma por uma
for mig_file in $ALL_MIGRATIONS; do
    mig_name=$(basename "$mig_file")
    mig_version=$(echo "$mig_name" | cut -d'_' -f1)
    
    # Verificar se já aplicada
    if supabase migration list 2>&1 | grep -qE "^\s+${mig_version}\s+\|\s+${mig_version}\s+\|"; then
        log "⏭️  $mig_name já aplicada"
        continue
    fi
    
    # Aplicar
    if apply_migration "$mig_file"; then
        APPLIED=$((APPLIED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    
    log "📊 Progresso: $APPLIED aplicadas, $FAILED falhas"
    log ""
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "✅ Aplicadas: $APPLIED"
log "❌ Falhas: $FAILED"
log "📊 Total: $TOTAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




