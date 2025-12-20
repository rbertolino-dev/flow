#!/bin/bash

# Script auxiliar para migração do Supabase
# Uso: ./scripts/migracao_helper.sh [comando]

set -e

PROJECT_ID_ANTIGO="orcbxgajfhgmjobsjlix"
NOVO_PROJECT_ID="${NOVO_PROJECT_ID:-}"

case "$1" in
    backup)
        echo "🔄 Fazendo backup do projeto $PROJECT_ID_ANTIGO..."
        DATE=$(date +%Y%m%d_%H%M%S)
        
        # Backup do banco
        echo "📦 Fazendo backup do banco de dados..."
        supabase db dump -f "backup_${DATE}_database.sql" --project-ref "$PROJECT_ID_ANTIGO" || {
            echo "⚠️  Erro ao fazer backup. Tentando método alternativo..."
            supabase db dump -f "backup_${DATE}_database.sql"
        }
        
        # Listar funções
        echo "📋 Listando Edge Functions..."
        ls -1 supabase/functions/ > "backup_${DATE}_funcoes.txt"
        
        # Backup config
        echo "⚙️  Fazendo backup da configuração..."
        cp supabase/config.toml "backup_${DATE}_config.toml"
        
        echo "✅ Backup concluído!"
        echo "   - backup_${DATE}_database.sql"
        echo "   - backup_${DATE}_funcoes.txt"
        echo "   - backup_${DATE}_config.toml"
        ;;
    
    list-functions)
        echo "📋 Lista de Edge Functions:"
        ls -1 supabase/functions/ | nl
        echo ""
        echo "Total: $(ls -1 supabase/functions/ | wc -l) funções"
        ;;
    
    deploy-all)
        if [ -z "$NOVO_PROJECT_ID" ]; then
            echo "❌ Erro: Defina NOVO_PROJECT_ID"
            echo "   export NOVO_PROJECT_ID=seu-novo-id"
            exit 1
        fi
        
        echo "🚀 Fazendo deploy de todas as Edge Functions para $NOVO_PROJECT_ID..."
        
        for func_dir in supabase/functions/*/; do
            func_name=$(basename "$func_dir")
            echo "📦 Deploying $func_name..."
            
            if supabase functions deploy "$func_name" --project-ref "$NOVO_PROJECT_ID"; then
                echo "✅ $func_name deployado com sucesso"
            else
                echo "❌ Erro ao fazer deploy de $func_name"
            fi
        done
        
        echo "✅ Deploy concluído!"
        ;;
    
    check-migrations)
        echo "🔍 Verificando migrations..."
        echo "Total de migrations: $(ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l)"
        echo ""
        echo "Últimas 10 migrations:"
        ls -1t supabase/migrations/*.sql 2>/dev/null | head -10
        ;;
    
    update-config)
        if [ -z "$NOVO_PROJECT_ID" ]; then
            echo "❌ Erro: Defina NOVO_PROJECT_ID"
            echo "   export NOVO_PROJECT_ID=seu-novo-id"
            exit 1
        fi
        
        echo "⚙️  Atualizando config.toml..."
        
        # Backup do config atual
        cp supabase/config.toml supabase/config.toml.backup
        
        # Atualizar project_id
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/project_id = \".*\"/project_id = \"$NOVO_PROJECT_ID\"/" supabase/config.toml
        else
            # Linux
            sed -i "s/project_id = \".*\"/project_id = \"$NOVO_PROJECT_ID\"/" supabase/config.toml
        fi
        
        echo "✅ config.toml atualizado!"
        echo "   Backup salvo em: supabase/config.toml.backup"
        ;;
    
    generate-types)
        if [ -z "$NOVO_PROJECT_ID" ]; then
            echo "❌ Erro: Defina NOVO_PROJECT_ID"
            echo "   export NOVO_PROJECT_ID=seu-novo-id"
            exit 1
        fi
        
        echo "📝 Gerando tipos TypeScript..."
        supabase gen types typescript --project-id "$NOVO_PROJECT_ID" > src/integrations/supabase/types.ts
        
        echo "✅ Tipos gerados em src/integrations/supabase/types.ts"
        ;;
    
    *)
        echo "📋 Script de Migração do Supabase"
        echo ""
        echo "Uso: $0 [comando]"
        echo ""
        echo "Comandos disponíveis:"
        echo "  backup              - Fazer backup completo do projeto atual"
        echo "  list-functions      - Listar todas as Edge Functions"
        echo "  deploy-all          - Deploy de todas as Edge Functions (requer NOVO_PROJECT_ID)"
        echo "  check-migrations    - Verificar migrations"
        echo "  update-config       - Atualizar project_id no config.toml (requer NOVO_PROJECT_ID)"
        echo "  generate-types      - Gerar tipos TypeScript do novo projeto (requer NOVO_PROJECT_ID)"
        echo ""
        echo "Exemplos:"
        echo "  $0 backup"
        echo "  export NOVO_PROJECT_ID=seu-novo-id"
        echo "  $0 update-config"
        echo "  $0 deploy-all"
        ;;
esac





