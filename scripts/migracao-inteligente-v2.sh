#!/bin/bash
# 🧠 Script Inteligente V2 - Aplica migrations uma por uma com auto-correção
# Detecta erros, corrige automaticamente, tenta novamente, vai para próxima

set +e

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-inteligente-v2.log"
PID_FILE="/tmp/migration-inteligente-v2.pid"

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
log "🧠 MIGRAÇÃO INTELIGENTE V2 - AUTO-CORREÇÃO"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Função para corrigir migration baseado no erro
fix_migration_error() {
    local mig_file="$1"
    local error_output="$2"
    
    # Detectar policy already exists
    if echo "$error_output" | grep -qi "policy.*already exists"; then
        policy_name=$(echo "$error_output" | sed -n 's/.*policy "\([^"]*\)".*/\1/p' | head -1)
        table_name=$(echo "$error_output" | sed -n 's/.*table "\([^"]*\)".*/\1/p' | head -1)
        
        if [ -n "$policy_name" ] && [ -n "$table_name" ]; then
            log "🔧 Corrigindo: Adicionando DROP POLICY para '$policy_name' em $table_name"
            
            # Backup
            [ ! -f "${mig_file}.backup" ] && cp "$mig_file" "${mig_file}.backup"
            
            # Adicionar DROP antes do CREATE
            sed -i "s|CREATE POLICY \"$policy_name\"|DROP POLICY IF EXISTS \"$policy_name\" ON $table_name;\nCREATE POLICY \"$policy_name\"|" "$mig_file"
            return 0
        fi
    fi
    
    # Detectar trigger already exists
    if echo "$error_output" | grep -qi "trigger.*already exists"; then
        trigger_name=$(echo "$error_output" | sed -n 's/.*trigger "\([^"]*\)".*/\1/p' | head -1)
        table_name=$(echo "$error_output" | sed -n 's/.*relation "\([^"]*\)".*/\1/p' | head -1)
        
        if [ -n "$trigger_name" ] && [ -n "$table_name" ]; then
            log "🔧 Corrigindo: Adicionando DROP TRIGGER para '$trigger_name' em $table_name"
            
            [ ! -f "${mig_file}.backup" ] && cp "$mig_file" "${mig_file}.backup"
            
            sed -i "s|CREATE TRIGGER $trigger_name ON $table_name|DROP TRIGGER IF EXISTS $trigger_name ON $table_name CASCADE;\nCREATE TRIGGER $trigger_name ON $table_name|" "$mig_file"
            return 0
        fi
    fi
    
    # Detectar function already exists
    if echo "$error_output" | grep -qi "function.*already exists"; then
        func_name=$(echo "$error_output" | sed -n 's/.*function "\([^"]*\)".*/\1/p' | head -1)
        
        if [ -n "$func_name" ]; then
            log "🔧 Corrigindo: Adicionando DROP FUNCTION para '$func_name'"
            
            [ ! -f "${mig_file}.backup" ] && cp "$mig_file" "${mig_file}.backup"
            
            # Encontrar linha CREATE FUNCTION e adicionar DROP antes
            sed -i "/CREATE.*FUNCTION.*$func_name/i DROP FUNCTION IF EXISTS $func_name CASCADE;" "$mig_file"
            return 0
        fi
    fi
    
    return 1
}

# Aplicar migration com retry e auto-correção
apply_migration_with_fix() {
    local mig_file="$1"
    local mig_name=$(basename "$mig_file")
    local max_attempts=5
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        
        log "📦 [$attempt/$max_attempts] Aplicando: $mig_name"
        
        # Tentar aplicar via supabase db push (migration específica)
        # Como não podemos aplicar uma migration específica, vamos usar SQL direto
        OUTPUT=$(psql "$DATABASE_URL" -f "$mig_file" 2>&1)
        
        # Se não tiver psql, usar supabase db execute
        if [ $? -ne 0 ] || ! command -v psql &> /dev/null; then
            # Usar método alternativo: aplicar via SQL Editor (simulado)
            # Na prática, vamos usar supabase migration up com a migration específica
            OUTPUT=$(supabase db push --include-all 2>&1 | grep -A 20 "$mig_name")
        fi
        
        # Verificar sucesso
        if echo "$OUTPUT" | grep -qiE "success|applied|completed"; then
            log "✅ $mig_name aplicada com sucesso!"
            return 0
        fi
        
        # Verificar se é erro de "already exists"
        if echo "$OUTPUT" | grep -qiE "already exists|duplicate"; then
            log "⚠️  Erro 'already exists' detectado"
            
            # Tentar corrigir
            if fix_migration_error "$mig_file" "$OUTPUT"; then
                log "✅ Migration corrigida! Tentando novamente..."
                continue
            else
                log "⚠️  Não foi possível corrigir automaticamente"
            fi
        fi
        
        # Mostrar erro
        ERROR=$(echo "$OUTPUT" | grep -i "ERROR" | head -1)
        if [ -n "$ERROR" ]; then
            log "❌ Erro: $ERROR"
        fi
    done
    
    log "⚠️  Não foi possível aplicar $mig_name após $max_attempts tentativas"
    return 1
}

# Listar migrations pendentes
log "📋 Obtendo lista de migrations pendentes..."

# Pegar todas as migrations locais
ALL_MIGRATIONS=$(ls -1 supabase/migrations/*.sql 2>/dev/null | grep -v backup | grep -v original | sort)

TOTAL=$(echo "$ALL_MIGRATIONS" | wc -l)
log "📊 Total de migrations: $TOTAL"
log ""

APPLIED=0
FAILED=0

# Aplicar cada migration
for mig_file in $ALL_MIGRATIONS; do
    mig_name=$(basename "$mig_file")
    mig_version=$(echo "$mig_name" | cut -d'_' -f1)
    
    # Verificar se já foi aplicada
    if supabase migration list 2>&1 | grep -qE "^\s+${mig_version}\s+\|\s+${mig_version}\s+\|"; then
        log "⏭️  $mig_name já aplicada (pulando)"
        continue
    fi
    
    # Aplicar com auto-correção
    if apply_migration_with_fix "$mig_file"; then
        APPLIED=$((APPLIED + 1))
        log "✅ Progresso: $APPLIED/$TOTAL aplicadas"
    else
        FAILED=$((FAILED + 1))
        log "❌ Falha: $FAILED migrations falharam"
        # Continuar mesmo com falha
    fi
    
    log ""
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO:"
log "   ✅ Aplicadas: $APPLIED"
log "   ❌ Falhas: $FAILED"
log "   📊 Total: $TOTAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"




