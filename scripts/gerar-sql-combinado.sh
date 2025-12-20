#!/bin/bash
# Script para gerar arquivo SQL combinado de todas as migrations
# Útil para aplicar via SQL Editor do Supabase

set -e

cd "$(dirname "$0")/.." || exit 1

OUTPUT_FILE="migrations-combinadas.sql"

echo "📦 Gerando arquivo SQL combinado..."
echo ""

# Limpar arquivo anterior
> "$OUTPUT_FILE"

# Adicionar cabeçalho
cat >> "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- Migrations Combinadas para Supabase
-- Gerado automaticamente
-- ============================================
-- 
-- INSTRUÇÕES:
-- 1. Copie todo este conteúdo
-- 2. Cole no SQL Editor do Supabase Dashboard
-- 3. Execute (pode levar alguns minutos)
-- 4. Erros de "already exists" são normais
--
-- ============================================

BEGIN;

EOF

# Contar migrations
TOTAL=$(find supabase/migrations -name "*.sql" -type f | wc -l)
COUNT=0

# Processar cada migration em ordem
find supabase/migrations -name "*.sql" -type f | sort | while read -r migration; do
    COUNT=$((COUNT + 1))
    FILENAME=$(basename "$migration")
    
    echo "  [$COUNT/$TOTAL] Processando: $FILENAME"
    
    # Adicionar separador
    cat >> "$OUTPUT_FILE" << EOF

-- ============================================
-- Migration: $FILENAME
-- ============================================

EOF
    
    # Adicionar conteúdo da migration
    cat "$migration" >> "$OUTPUT_FILE"
    
    # Adicionar linha em branco
    echo "" >> "$OUTPUT_FILE"
done

# Adicionar rodapé
cat >> "$OUTPUT_FILE" << 'EOF'

-- ============================================
-- Fim das Migrations
-- ============================================

COMMIT;

-- Nota: Se houver erros, você pode executar migrations individuais
-- ou ajustar manualmente conforme necessário
EOF

echo ""
echo "✅ Arquivo gerado: $OUTPUT_FILE"
echo "📊 Total de migrations: $TOTAL"
echo ""
echo "📝 Próximos passos:"
echo "  1. Abra o arquivo: $OUTPUT_FILE"
echo "  2. Copie todo o conteúdo"
echo "  3. Cole no SQL Editor do Supabase"
echo "  4. Execute"
echo ""




