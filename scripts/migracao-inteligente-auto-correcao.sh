#!/bin/bash
# 🧠 Script Inteligente com Auto-Correção
# Detecta erros, corrige automaticamente e continua até aplicar todas

set +e  # Não parar em erros

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/migration-inteligente.log"
PID_FILE="/tmp/migration-inteligente.pid"
STATUS_FILE="/tmp/migration-inteligente-status.txt"
FIXED_MIGRATIONS="/tmp/migration-inteligente-fixed.txt"

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
log "🧠 INICIANDO MIGRAÇÃO INTELIGENTE"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "📝 Log: $LOG_FILE"
log "🆔 PID: $$"
log ""

# Função para corrigir migration automaticamente
fix_migration() {
    local mig_file="$1"
    local error_type="$2"
    local error_detail="$3"
    
    log "🔧 Corrigindo: $mig_file"
    log "   Erro: $error_type"
    log "   Detalhe: $error_detail"
    
    # Backup da migration original
    if [ ! -f "${mig_file}.original" ]; then
        cp "$mig_file" "${mig_file}.original"
    fi
    
    # Extrair nome do objeto do erro
    local object_name=""
    local table_name=""
    
    # Detectar tipo de erro e extrair informações
    if echo "$error_detail" | grep -qi "policy.*already exists"; then
        # Policy: "policy \"nome\" for table \"tabela\" already exists"
        object_name=$(echo "$error_detail" | sed -n 's/.*policy "\([^"]*\)".*/\1/p')
        table_name=$(echo "$error_detail" | sed -n 's/.*table "\([^"]*\)".*/\1/p')
        
        if [ -n "$object_name" ] && [ -n "$table_name" ]; then
            log "   Adicionando: DROP POLICY IF EXISTS \"$object_name\" ON $table_name;"
            
            # Adicionar DROP antes do CREATE POLICY correspondente
            sed -i "s|CREATE POLICY \"$object_name\"|DROP POLICY IF EXISTS \"$object_name\" ON $table_name;\nCREATE POLICY \"$object_name\"|" "$mig_file"
            
            echo "$mig_file|policy|$object_name|$table_name" >> "$FIXED_MIGRATIONS"
            return 0
        fi
    elif echo "$error_detail" | grep -qi "trigger.*already exists"; then
        # Trigger: "trigger \"nome\" for relation \"tabela\" already exists"
        object_name=$(echo "$error_detail" | sed -n 's/.*trigger "\([^"]*\)".*/\1/p')
        table_name=$(echo "$error_detail" | sed -n 's/.*relation "\([^"]*\)".*/\1/p')
        
        if [ -n "$object_name" ] && [ -n "$table_name" ]; then
            log "   Adicionando: DROP TRIGGER IF EXISTS $object_name ON $table_name CASCADE;"
            
            sed -i "s|CREATE TRIGGER $object_name ON $table_name|DROP TRIGGER IF EXISTS $object_name ON $table_name CASCADE;\nCREATE TRIGGER $object_name ON $table_name|" "$mig_file"
            
            echo "$mig_file|trigger|$object_name|$table_name" >> "$FIXED_MIGRATIONS"
            return 0
        fi
    elif echo "$error_detail" | grep -qi "function.*already exists"; then
        # Function: "function \"nome\" already exists"
        object_name=$(echo "$error_detail" | sed -n 's/.*function "\([^"]*\)".*/\1/p' | head -1)
        
        if [ -n "$object_name" ]; then
            log "   Adicionando: DROP FUNCTION IF EXISTS $object_name CASCADE;"
            
            # Extrair nome completo da função (pode ter schema)
            full_func_name=$(grep -i "CREATE.*FUNCTION.*$object_name" "$mig_file" | head -1 | sed -n 's/.*CREATE.*FUNCTION[^(]*\([^(]*\).*/\1/p' | xargs)
            
            if [ -n "$full_func_name" ]; then
                sed -i "s|CREATE FUNCTION $full_func_name|DROP FUNCTION IF EXISTS $full_func_name CASCADE;\nCREATE FUNCTION $full_func_name|" "$mig_file"
            else
                sed -i "s|CREATE FUNCTION.*$object_name|DROP FUNCTION IF EXISTS $object_name CASCADE;\n&|" "$mig_file"
            fi
            
            echo "$mig_file|function|$object_name|" >> "$FIXED_MIGRATIONS"
            return 0
        fi
    elif echo "$error_detail" | grep -qi "index.*already exists"; then
        # Index: "index \"nome\" already exists"
        object_name=$(echo "$error_detail" | sed -n 's/.*index "\([^"]*\)".*/\1/p')
        
        if [ -n "$object_name" ]; then
            log "   Adicionando: DROP INDEX IF EXISTS $object_name CASCADE;"
            
            sed -i "s|CREATE.*INDEX.*$object_name|DROP INDEX IF EXISTS $object_name CASCADE;\n&|" "$mig_file"
            
            echo "$mig_file|index|$object_name|" >> "$FIXED_MIGRATIONS"
            return 0
        fi
    fi
    
    log "   ⚠️  Não foi possível corrigir automaticamente"
    return 1
}

# Função para aplicar uma migration específica
apply_single_migration() {
    local mig_file="$1"
    local mig_name=$(basename "$mig_file")
    local max_retries=3
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        log ""
        log "📦 Aplicando: $mig_name (tentativa $((retry + 1))/$max_retries)"
        
        # Aplicar migration específica via SQL direto
        OUTPUT=$(supabase db execute --file "$mig_file" 2>&1)
        EXIT_CODE=$?
        
        # Verificar se teve sucesso
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qi "success\|applied"; then
            log "✅ $mig_name aplicada com sucesso!"
            return 0
        fi
        
        # Verificar se é erro de "already exists"
        if echo "$OUTPUT" | grep -qiE "already exists|duplicate"; then
            ERROR_LINE=$(echo "$OUTPUT" | grep -iE "already exists|duplicate" | head -1)
            ERROR_TYPE=$(echo "$ERROR_LINE" | grep -oE "(policy|trigger|function|index|relation).*already exists" | head -1)
            
            if [ -n "$ERROR_TYPE" ]; then
                log "⚠️  Erro detectado: $ERROR_TYPE"
                
                # Tentar corrigir
                if fix_migration "$mig_file" "$ERROR_TYPE" "$ERROR_LINE"; then
                    log "✅ Migration corrigida! Tentando novamente..."
                    retry=$((retry + 1))
                    continue
                fi
            fi
        fi
        
        # Outros erros
        log "❌ Erro ao aplicar $mig_name:"
        echo "$OUTPUT" | grep -i "ERROR" | head -3 | while read line; do
            log "   $line"
        done
        
        retry=$((retry + 1))
    done
    
    log "⚠️  Não foi possível aplicar $mig_name após $max_retries tentativas"
    return 1
}

# Listar todas as migrations pendentes
log "📋 Listando migrations pendentes..."
PENDING_MIGRATIONS=$(supabase migration list 2>&1 | grep -E "^\s+[0-9]+\s+\|\s+\s+\|" | awk '{print $1}' | sort)

if [ -z "$PENDING_MIGRATIONS" ]; then
    # Se não conseguir listar, pegar todas as migrations locais
    PENDING_MIGRATIONS=$(ls -1 supabase/migrations/*.sql 2>/dev/null | grep -v backup | grep -v original | sort)
fi

TOTAL=$(echo "$PENDING_MIGRATIONS" | wc -l)
log "📊 Total de migrations: $TOTAL"
log ""

# Aplicar cada migration uma por uma
APPLIED=0
FAILED=0
SKIPPED=0

for mig_version in $PENDING_MIGRATIONS; do
    # Encontrar arquivo da migration
    mig_file=$(find supabase/migrations -name "${mig_version}_*.sql" 2>/dev/null | head -1)
    
    if [ -z "$mig_file" ]; then
        # Tentar pelo número apenas
        mig_file=$(ls -1 supabase/migrations/${mig_version}*.sql 2>/dev/null | grep -v backup | grep -v original | head -1)
    fi
    
    if [ -z "$mig_file" ] || [ ! -f "$mig_file" ]; then
        log "⚠️  Arquivo não encontrado para migration $mig_version"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Verificar se já foi aplicada
    if supabase migration list 2>&1 | grep -qE "^\s+${mig_version}\s+\|\s+${mig_version}\s+\|"; then
        log "⏭️  $mig_version já aplicada (pulando)"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi
    
    # Aplicar migration
    if apply_single_migration "$mig_file"; then
        APPLIED=$((APPLIED + 1))
        
        # Marcar como aplicada manualmente se necessário
        log "✅ Migration $mig_version aplicada! ($APPLIED/$TOTAL)"
    else
        FAILED=$((FAILED + 1))
        log "❌ Falha ao aplicar $mig_version ($FAILED falhas)"
    fi
    
    # Atualizar status
    echo "$APPLIED|$FAILED|$SKIPPED|$TOTAL" > "$STATUS_FILE"
    
    log ""
done

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO FINAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "✅ Aplicadas: $APPLIED"
log "❌ Falhas: $FAILED"
log "⏭️  Puladas: $SKIPPED"
log "📊 Total: $TOTAL"
log ""
log "🔧 Migrations corrigidas: $(wc -l < "$FIXED_MIGRATIONS" 2>/dev/null || echo 0)"
log ""

if [ $FAILED -eq 0 ]; then
    log "🎉 🎉 🎉 SUCESSO COMPLETO! 🎉 🎉 🎉"
    exit 0
else
    log "⚠️  Algumas migrations falharam, mas o processo continuou"
    exit 1
fi




