#!/bin/bash
# Script para adicionar DROP POLICY IF EXISTS antes de todas as CREATE POLICY
# que ainda não têm

set -e

cd "$(dirname "$0")/.." || exit 1

echo "🔍 Procurando policies sem DROP POLICY IF EXISTS..."
echo ""

CORRIGIDAS=0

# Encontrar todas as migrations
find supabase/migrations -name "*.sql" -type f | sort | while read -r migration; do
    FILENAME=$(basename "$migration")
    
    # Verificar se há CREATE POLICY sem DROP POLICY correspondente
    # Procurar por CREATE POLICY que não tem DROP POLICY IF EXISTS antes
    if grep -q "CREATE POLICY" "$migration"; then
        # Ler o arquivo linha por linha
        TEMP_FILE=$(mktemp)
        MODIFICADO=false
        IFS=''
        
        while IFS= read -r line || [ -n "$line" ]; do
            # Se encontrou CREATE POLICY
            if echo "$line" | grep -q "CREATE POLICY"; then
                # Extrair nome da policy
                POLICY_NAME=$(echo "$line" | sed -n 's/.*CREATE POLICY "\([^"]*\)".*/\1/p')
                
                if [ -n "$POLICY_NAME" ]; then
                    # Verificar se já tem DROP POLICY antes (nas últimas 5 linhas)
                    # Verificar se a linha anterior não é DROP POLICY
                    PREV_LINES=$(tail -5 "$TEMP_FILE" 2>/dev/null || echo "")
                    
                    if ! echo "$PREV_LINES" | grep -q "DROP POLICY IF EXISTS.*$POLICY_NAME"; then
                        # Extrair nome da tabela (próxima linha geralmente tem ON table_name)
                        # Mas vamos adicionar depois de ler a próxima linha
                        echo "$line" >> "$TEMP_FILE"
                        
                        # Ler próxima linha para pegar o nome da tabela
                        read -r next_line || true
                        if echo "$next_line" | grep -q "ON public\."; then
                            TABLE_NAME=$(echo "$next_line" | sed -n 's/.*ON public\.\([a-z_]*\).*/\1/p')
                            
                            if [ -n "$TABLE_NAME" ]; then
                                # Adicionar DROP POLICY antes
                                sed -i "\$aDROP POLICY IF EXISTS \"$POLICY_NAME\" ON public.$TABLE_NAME;" "$TEMP_FILE"
                                MODIFICADO=true
                                echo "  ✅ $FILENAME: Adicionado DROP POLICY para \"$POLICY_NAME\""
                                CORRIGIDAS=$((CORRIGIDAS + 1))
                            fi
                        fi
                        echo "$next_line" >> "$TEMP_FILE" 2>/dev/null || true
                        continue
                    fi
                fi
            fi
            
            echo "$line" >> "$TEMP_FILE"
        done < "$migration"
        
        if [ "$MODIFICADO" = true ]; then
            mv "$TEMP_FILE" "$migration"
        else
            rm -f "$TEMP_FILE"
        fi
    fi
done

echo ""
echo "✅ Correções aplicadas: $CORRIGIDAS policies"
echo ""
echo "🔄 Regenerando lotes..."
rm -rf migrations-lotes
./scripts/gerar-sql-com-lotes.sh > /dev/null 2>&1
echo "✅ Lotes regenerados!"




