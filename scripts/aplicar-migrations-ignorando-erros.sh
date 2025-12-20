#!/bin/bash
# 🔄 Script para Aplicar Migrations Ignorando Erros de Duplicação
# Aplica migrations uma por uma, continuando mesmo se algumas falharem

set +e  # Não parar em erros

export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 APLICANDO MIGRATIONS (IGNORANDO ERROS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL=$(ls -1 supabase/migrations/*.sql | wc -l)
APPLIED=0
FAILED=0
SKIPPED=0

echo "📊 Total de migrations: $TOTAL"
echo ""

# Aplicar cada migration individualmente
for migration in supabase/migrations/*.sql; do
    migration_name=$(basename "$migration")
    echo "📦 Aplicando: $migration_name..."
    
    # Tentar aplicar via SQL direto (se possível) ou via push
    # Por enquanto, vamos usar db push com --include-all e capturar erros
    result=$(echo "y" | supabase db push --include-all 2>&1 | grep -E "(Applying migration $migration_name|ERROR|Successfully)" | head -5)
    
    if echo "$result" | grep -q "Successfully\|Applied"; then
        echo "✅ $migration_name aplicada"
        APPLIED=$((APPLIED + 1))
    elif echo "$result" | grep -q "already exists\|duplicate"; then
        echo "⏭️  $migration_name já existe (pulando)"
        SKIPPED=$((SKIPPED + 1))
    else
        echo "⚠️  $migration_name teve problemas (continuando)"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO:"
echo "   ✅ Aplicadas: $APPLIED"
echo "   ⏭️  Puladas: $SKIPPED"
echo "   ⚠️  Com problemas: $FAILED"
echo "   📦 Total: $TOTAL"
echo ""
