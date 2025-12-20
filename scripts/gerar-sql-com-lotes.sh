#!/bin/bash
# Script para gerar arquivos SQL em lotes
# Útil para aplicar migrations em grupos menores

set -e

cd "$(dirname "$0")/.." || exit 1

LOTE_SIZE=20  # Quantidade de migrations por lote
LOTE_NUM=1

echo "📦 Gerando arquivos SQL em lotes de $LOTE_SIZE migrations..."
echo ""

# Criar diretório para lotes
mkdir -p migrations-lotes

# Contar migrations
TOTAL=$(find supabase/migrations -name "*.sql" -type f | wc -l)
COUNT=0
CURRENT_LOTE_COUNT=0

# Processar cada migration em ordem
find supabase/migrations -name "*.sql" -type f | sort | while read -r migration; do
    COUNT=$((COUNT + 1))
    
    # Iniciar novo lote se necessário
    if [ $CURRENT_LOTE_COUNT -eq 0 ]; then
        OUTPUT_FILE="migrations-lotes/lote-$(printf "%02d" $LOTE_NUM).sql"
        > "$OUTPUT_FILE"
        
        cat >> "$OUTPUT_FILE" << EOF
-- ============================================
-- Lote $LOTE_NUM de Migrations
-- Migrations $((COUNT)) até $((COUNT + LOTE_SIZE - 1))
-- ============================================

BEGIN;

EOF
    fi
    
    FILENAME=$(basename "$migration")
    CURRENT_LOTE_COUNT=$((CURRENT_LOTE_COUNT + 1))
    
    echo "  [$COUNT/$TOTAL] Lote $LOTE_NUM: $FILENAME"
    
    # Adicionar separador
    cat >> "$OUTPUT_FILE" << EOF

-- Migration: $FILENAME
EOF
    
    # Adicionar conteúdo da migration
    cat "$migration" >> "$OUTPUT_FILE"
    
    echo "" >> "$OUTPUT_FILE"
    
    # Finalizar lote se atingiu o tamanho
    if [ $CURRENT_LOTE_COUNT -eq $LOTE_SIZE ]; then
        cat >> "$OUTPUT_FILE" << 'EOF'

COMMIT;
EOF
        echo "  ✅ Lote $LOTE_NUM gerado: $OUTPUT_FILE"
        LOTE_NUM=$((LOTE_NUM + 1))
        CURRENT_LOTE_COUNT=0
    fi
done

# Finalizar último lote se não foi finalizado
if [ $CURRENT_LOTE_COUNT -gt 0 ]; then
    cat >> "$OUTPUT_FILE" << 'EOF'

COMMIT;
EOF
    echo "  ✅ Lote $LOTE_NUM gerado: $OUTPUT_FILE"
fi

echo ""
echo "✅ Lotes gerados em: migrations-lotes/"
echo "📊 Total de lotes: $LOTE_NUM"
echo ""
echo "📝 Como usar:"
echo "  1. Aplique os lotes em ordem (lote-01.sql, lote-02.sql, etc)"
echo "  2. Verifique se há erros após cada lote"
echo "  3. Continue com o próximo lote"
echo ""




