#!/bin/bash
# Script para aplicar migrations em lote de forma rápida e segura
# Ignora erros de "already exists" mas para em erros críticos

set -e

ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Erro: SUPABASE_ACCESS_TOKEN não definido"
    echo "Execute: export SUPABASE_ACCESS_TOKEN='sbp_...'"
    exit 1
fi

export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"

cd "$(dirname "$0")/.." || exit 1

echo "🚀 Iniciando aplicação rápida de migrations..."
echo "📊 Verificando migrations pendentes..."

# Contar migrations pendentes
PENDING=$(supabase migration list 2>&1 | grep -c "Pending" || echo "0")
echo "📋 Migrations pendentes: $PENDING"

# Aplicar migrations em lote
echo ""
echo "🔄 Aplicando migrations (ignorando erros de 'already exists')..."
echo ""

# Tentar aplicar todas as migrations
# O comando db push já aplica em lote, mas vamos fazer com retry automático
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "📦 Tentativa $((RETRY_COUNT + 1)) de $MAX_RETRIES..."
    
    # Aplicar migrations
    OUTPUT=$(echo "y" | timeout 1800 supabase db push 2>&1)
    EXIT_CODE=$?
    
    # Verificar se houve sucesso ou apenas erros de "already exists"
    if echo "$OUTPUT" | grep -q "Successfully\|Finished applying"; then
        echo "✅ Migrations aplicadas com sucesso!"
        echo "$OUTPUT" | grep -E "(Successfully|Finished|applied)" | tail -5
        exit 0
    fi
    
    # Verificar se há erros críticos (não relacionados a "already exists")
    CRITICAL_ERRORS=$(echo "$OUTPUT" | grep -i "ERROR" | grep -v "already exists" | grep -v "duplicate key" | grep -v "relation.*already exists" | grep -v "policy.*already exists" || true)
    
    if [ -n "$CRITICAL_ERRORS" ]; then
        echo "❌ Erro crítico encontrado:"
        echo "$CRITICAL_ERRORS" | head -5
        echo ""
        echo "📝 Últimas linhas do log:"
        echo "$OUTPUT" | tail -20
        exit 1
    fi
    
    # Se chegou aqui, provavelmente são apenas erros de "already exists"
    echo "⚠️  Algumas migrations já foram aplicadas. Continuando..."
    RETRY_COUNT=$((RETRY_COUNT + 1))
    
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "⏳ Aguardando 2 segundos antes de tentar novamente..."
        sleep 2
    fi
done

echo "✅ Processo concluído (algumas migrations podem já ter sido aplicadas)"
echo "📊 Status final:"
supabase migration list 2>&1 | grep -E "(Pending|Applied)" | head -10
