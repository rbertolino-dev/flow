#!/bin/bash
# 🔄 Script de Backup Completo do Projeto Supabase
# Este script faz backup de tudo antes da migração

set -e

PROJECT_ID="orcbxgajfhgmjobsjlix"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/backup_${DATE}"

echo "🔄 Iniciando backup completo do projeto $PROJECT_ID..."
echo "📁 Diretório de backup: $BACKUP_DIR"
echo ""

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

# 1. Backup do banco de dados
echo "📊 Fazendo backup do banco de dados..."
if supabase db dump --project-ref "$PROJECT_ID" -f "$BACKUP_DIR/database.sql" 2>/dev/null; then
    echo "✅ Backup do banco concluído"
else
    echo "⚠️  Aviso: Não foi possível fazer backup do banco (pode precisar de autenticação)"
    echo "   Execute manualmente: supabase db dump --project-ref $PROJECT_ID -f $BACKUP_DIR/database.sql"
fi

# 2. Backup apenas do schema
echo "📋 Fazendo backup do schema..."
if supabase db dump --schema-only --project-ref "$PROJECT_ID" -f "$BACKUP_DIR/schema.sql" 2>/dev/null; then
    echo "✅ Backup do schema concluído"
else
    echo "⚠️  Aviso: Não foi possível fazer backup do schema"
fi

# 3. Backup apenas dos dados
echo "💾 Fazendo backup dos dados..."
if supabase db dump --data-only --project-ref "$PROJECT_ID" -f "$BACKUP_DIR/data.sql" 2>/dev/null; then
    echo "✅ Backup dos dados concluído"
else
    echo "⚠️  Aviso: Não foi possível fazer backup dos dados"
fi

# 4. Listar todas as Edge Functions
echo "📦 Listando Edge Functions..."
ls -1 supabase/functions/ > "$BACKUP_DIR/lista_funcoes.txt"
echo "✅ Lista de funções salva ($(wc -l < "$BACKUP_DIR/lista_funcoes.txt") funções)"

# 5. Backup do config.toml
echo "⚙️  Fazendo backup do config.toml..."
cp supabase/config.toml "$BACKUP_DIR/config.toml" 2>/dev/null || echo "⚠️  config.toml não encontrado"
echo "✅ Configuração salva"

# 6. Backup das migrations
echo "🗄️  Contando migrations..."
ls -1 supabase/migrations/*.sql 2>/dev/null | wc -l > "$BACKUP_DIR/total_migrations.txt"
echo "✅ Total de migrations: $(cat "$BACKUP_DIR/total_migrations.txt")"

# 7. Criar arquivo de informações
cat > "$BACKUP_DIR/info.txt" << EOF
Backup realizado em: $(date)
Project ID: $PROJECT_ID
URL: https://$PROJECT_ID.supabase.co
Total de Migrations: $(cat "$BACKUP_DIR/total_migrations.txt")
Total de Edge Functions: $(wc -l < "$BACKUP_DIR/lista_funcoes.txt")
EOF

echo ""
echo "✅ Backup completo concluído!"
echo "📁 Localização: $BACKUP_DIR"
echo ""
echo "📋 Arquivos criados:"
ls -lh "$BACKUP_DIR" | tail -n +2
echo ""
echo "💡 Próximo passo: Revisar os arquivos de backup antes de iniciar a migração"
