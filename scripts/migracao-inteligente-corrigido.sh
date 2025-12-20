#!/bin/bash
# 🧠 Script Inteligente Corrigido - Usa método correto do Supabase CLI
# Aplica migrations uma por uma, detecta erros, corrige e continua

set +e

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-inteligente-corrigido.log"
PID_FILE="/tmp/migration-inteligente-corrigido.pid"

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
log "🧠 MIGRAÇÃO INTELIGENTE - VERSÃO CORRIGIDA"
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

# Aplicar migration específica via supabase db push (filtrado)
apply_migration() {
    local mig_file="$1"
    local mig_name=$(basename "$mig_file")
    local mig_version=$(echo "$mig_name" | cut -d'_' -f1)
    local max_retries=10
    local retry=0
    
    # Verificar se já foi aplicada
    if supabase migration list 2>&1 | grep -qE "^\s+${mig_version}\s+\|\s+${mig_version}\s+\|"; then
        log "⏭️  $mig_name já aplicada"
        return 0
    fi
    
    while [ $retry -lt $max_retries ]; do
        retry=$((retry + 1))
        log "📦 [$retry/$max_retries] $mig_name"
        
        # Criar diretório temporário com apenas esta migration
        TEMP_DIR=$(mktemp -d)
        cp "$mig_file" "$TEMP_DIR/"
        
        # Aplicar via supabase db push (apenas esta migration)
        OUTPUT=$(cd "$TEMP_DIR" && echo "y" | timeout 60 supabase db push --include-all 2>&1)
        EXIT_CODE=$?
        
        # Limpar diretório temporário
        rm -rf "$TEMP_DIR"
        
        # Verificar sucesso
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "Successfully|Applied|completed"; then
            log "✅ $mig_name aplicada!"
            return 0
        fi
        
        # Verificar erro de "already exists"
        ERROR=$(echo "$OUTPUT" | grep -iE "already exists|duplicate" | head -1)
        if [ -n "$ERROR" ]; then
            log "⚠️  Erro detectado: $ERROR"
            
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
    
    log "⚠️  Não foi possível aplicar $mig_name após $max_retries tentativas"
    return 1
}

# Método alternativo: aplicar via SQL direto usando supabase db execute
apply_migration_sql() {
    local mig_file="$1"
    local mig_name=$(basename "$mig_file")
    local mig_version=$(echo "$mig_name" | cut -d'_' -f1)
    local max_retries=10
    local retry=0
    
    # Verificar se já foi aplicada
    if supabase migration list 2>&1 | grep -qE "^\s+${mig_version}\s+\|\s+${mig_version}\s+\|"; then
        log "⏭️  $mig_name já aplicada"
        return 0
    fi
    
    while [ $retry -lt $max_retries ]; do
        retry=$((retry + 1))
        log "📦 [$retry/$max_retries] $mig_name"
        
        # Tentar aplicar via supabase db execute (se disponível)
        # Se não disponível, usar db push com migration específica
        OUTPUT=$(supabase db execute "$mig_file" 2>&1)
        EXIT_CODE=$?
        
        # Se db execute não existe, tentar outro método
        if echo "$OUTPUT" | grep -qi "unknown command\|command not found"; then
            # Usar método de aplicar via push com migration única
            TEMP_MIG_DIR=$(mktemp -d)
            cp "$mig_file" "$TEMP_MIG_DIR/"
            
            # Backup migrations originais
            mv supabase/migrations supabase/migrations.backup 2>/dev/null || true
            mkdir -p supabase/migrations
            cp "$mig_file" supabase/migrations/
            
            OUTPUT=$(echo "y" | timeout 60 supabase db push --include-all 2>&1)
            EXIT_CODE=$?
            
            # Restaurar migrations
            rm -rf supabase/migrations
            mv supabase/migrations.backup supabase/migrations 2>/dev/null || true
            rm -rf "$TEMP_MIG_DIR"
        fi
        
        # Verificar sucesso
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "Successfully|Applied|completed"; then
            log "✅ $mig_name aplicada!"
            
            # IMPORTANTE: Registrar na tabela schema_migrations
            # O método de aplicar migration única não registra automaticamente
            log "📝 Registrando migration $mig_version no banco..."
            supabase migration repair --status applied "$mig_version" 2>&1 | grep -v "Skipping" | head -3 || true
            
            return 0
        fi
        
        # Verificar erro de "already exists"
        ERROR=$(echo "$OUTPUT" | grep -iE "already exists|duplicate" | head -1)
        if [ -n "$ERROR" ]; then
            log "⚠️  Erro: $ERROR"
            
            if fix_migration "$mig_file" "$ERROR"; then
                log "✅ Corrigido! Tentando novamente..."
                continue
            fi
        fi
        
        # Outros erros
        ERR_MSG=$(echo "$OUTPUT" | grep -i "ERROR" | head -1)
        if [ -n "$ERR_MSG" ]; then
            log "❌ $ERR_MSG"
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
    
    # Tentar método SQL direto primeiro
    if apply_migration_sql "$mig_file"; then
        APPLIED=$((APPLIED + 1))
    else
        # Se falhar, tentar método alternativo
        if apply_migration "$mig_file"; then
            APPLIED=$((APPLIED + 1))
        else
            FAILED=$((FAILED + 1))
        fi
    fi
    
    log "📊 Progresso: $APPLIED aplicadas, $FAILED falhas"
    log ""
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO FINAL:"
log "   ✅ Aplicadas: $APPLIED"
log "   ❌ Falhas: $FAILED"
log "   📊 Total: $TOTAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




