#!/bin/bash
# 🚀 Script para Deploy de Todas as Edge Functions
# ATENÇÃO: Este script faz deploy para o projeto linkado
# Use apenas após criar novo projeto e fazer link

# Não sair em erro para continuar deploy mesmo se uma falhar
set +e

# Configurar token de acesso
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

LOG_FILE="/tmp/deploy-funcoes.log"

# Verificar se está linkado
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "❌ Erro: Projeto não está linkado ao Supabase"
    echo ""
    echo "💡 Para linkar, execute:"
    echo "   supabase link --project-ref [NOVO_PROJECT_ID]"
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

PROJECT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "desconhecido")
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Fazendo deploy de todas as Edge Functions..."
log "📦 Projeto: $PROJECT_REF"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

# Contar funções
TOTAL=$(find supabase/functions -maxdepth 1 -type d | wc -l)
TOTAL=$((TOTAL - 1))

echo "📊 Total de funções a fazer deploy: $TOTAL"
echo ""

# Contadores
SUCCESS=0
FAILED=0
FAILED_FUNCS=()

# Deploy de cada função
for func_dir in supabase/functions/*/; do
    if [ -d "$func_dir" ] && [ -f "$func_dir/index.ts" ]; then
        func_name=$(basename "$func_dir")
        log "📦 Deploying $func_name..."
        
        OUTPUT=$(supabase functions deploy "$func_name" 2>&1)
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ] || echo "$OUTPUT" | grep -qiE "Successfully|deployed|already"; then
            log "   ✅ $func_name deployado com sucesso"
            SUCCESS=$((SUCCESS + 1))
        else
            log "   ❌ Erro ao fazer deploy de $func_name"
            log "   📝 Erro: $OUTPUT"
            FAILED=$((FAILED + 1))
            FAILED_FUNCS+=("$func_name")
        fi
        log ""
        sleep 1
    fi
done

# Resumo
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "📊 RESUMO DO DEPLOY:"
log "   ✅ Sucesso: $SUCCESS"
log "   ❌ Falhas: $FAILED"
log "   📦 Total: $TOTAL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""

if [ $FAILED -gt 0 ]; then
    log "⚠️  Funções que falharam:"
    for func in "${FAILED_FUNCS[@]}"; do
        log "   - $func"
    done
    log ""
    log "💡 Tente fazer deploy manual dessas funções:"
    log "   supabase functions deploy [NOME_DA_FUNCAO]"
else
    log "🎉 Todas as funções foram deployadas com sucesso!"
fi

log ""
log "💡 Próximo passo: Configurar secrets/variáveis de ambiente no Dashboard"
log "📝 Log completo em: $LOG_FILE"
