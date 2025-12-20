#!/bin/bash
# Script para adicionar DROP POLICY IF EXISTS antes de todas as CREATE POLICY
# que ainda não têm

cd "$(dirname "$0")/.." || exit 1

echo "🔍 Procurando e corrigindo todas as policies sem DROP POLICY IF EXISTS..."
echo ""

CORRIGIDAS=0

# Encontrar todas as migrations
find supabase/migrations -name "*.sql" -type f | sort | while read -r migration; do
    FILENAME=$(basename "$migration")
    
    # Verificar se há CREATE POLICY
    if grep -q "CREATE POLICY" "$migration"; then
        TEMP_FILE=$(mktemp)
        MODIFICADO=false
        
        # Ler arquivo e processar
        awk '
        /^CREATE POLICY/ {
            # Encontrar nome da policy
            match($0, /"([^"]+)"/, policy_name)
            policy = policy_name[1]
            
            # Ler próxima linha para pegar nome da tabela
            getline next_line
            
            if (next_line ~ /ON public\./) {
                match(next_line, /ON public\.([a-z_]+)/, table_name)
                table = table_name[1]
                
                if (table != "") {
                    # Verificar se já tem DROP POLICY antes (últimas 10 linhas)
                    has_drop = 0
                    for (i = NR - 10; i < NR; i++) {
                        if (lines[i] ~ "DROP POLICY.*" policy) {
                            has_drop = 1
                            break
                        }
                    }
                    
                    if (!has_drop) {
                        print "DROP POLICY IF EXISTS \"" policy "\" ON public." table ";"
                        MODIFICADO = 1
                    }
                }
            }
            
            # Imprimir CREATE POLICY original
            print $0
            if (next_line != "") print next_line
            next
        }
        
        {
            lines[NR] = $0
            print $0
        }
        ' "$migration" > "$TEMP_FILE"
        
        if [ -f "$TEMP_FILE" ] && ! diff -q "$migration" "$TEMP_FILE" > /dev/null 2>&1; then
            mv "$TEMP_FILE" "$migration"
            echo "  ✅ $FILENAME: Policies corrigidas"
            CORRIGIDAS=$((CORRIGIDAS + 1))
        else
            rm -f "$TEMP_FILE"
        fi
    fi
done

echo ""
echo "✅ Correções aplicadas em $CORRIGIDAS migrations"
echo ""
echo "🔄 Regenerando lotes..."
rm -rf migrations-lotes
./scripts/gerar-sql-com-lotes.sh > /dev/null 2>&1
echo "✅ Lotes regenerados!"




