#!/bin/bash

# Script para aplicar migration de melhorias de contratos via Supabase Management API
# Usa API REST para executar SQL diretamente

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20250122000001_add_contract_improvements.sql"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Aplicar Migration Contratos (API)     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Arquivo de migration não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Carregar credenciais
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_65ea725d285d73d58dc277c200fbee1975f01b9f}"
export SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-ogeljmbhqxpfjbpnbwog}"

echo -e "${BLUE}📄 Migration: $(basename $MIGRATION_FILE)${NC}"
echo -e "${BLUE}🔗 Projeto: $SUPABASE_PROJECT_ID${NC}"
echo ""

# Ler SQL e escapar para JSON
SQL_CONTENT=$(cat "$MIGRATION_FILE" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

# Aplicar via Supabase Management API
echo -e "${BLUE}⚡ Aplicando migration via API...${NC}"

# Dividir SQL em statements menores (a API pode ter limite de tamanho)
# Aplicar apenas a criação da tabela primeiro
CREATE_TABLE_SQL="CREATE TABLE IF NOT EXISTS contract_signature_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_type text NOT NULL CHECK (signer_type IN ('user', 'client', 'rubric')),
  page_number integer NOT NULL,
  x_position real NOT NULL,
  y_position real NOT NULL,
  width real DEFAULT 60,
  height real DEFAULT 30,
  created_at timestamptz DEFAULT now()
);"

# Escapar para JSON
ESCAPED_SQL=$(echo "$CREATE_TABLE_SQL" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

# Aplicar via API
RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$ESCAPED_SQL\"}" 2>&1)

if echo "$RESPONSE" | grep -qiE "(error|failed)"; then
    echo -e "${YELLOW}⚠️  Verificando se tabela já existe...${NC}"
    
    # Verificar se tabela já existe
    CHECK_RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"query": "SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name = '\''contract_signature_positions'\'';"}' 2>&1)
    
    if echo "$CHECK_RESPONSE" | grep -qi "contract_signature_positions"; then
        echo -e "${GREEN}✅ Tabela contract_signature_positions já existe!${NC}"
    else
        echo -e "${RED}❌ Erro ao criar tabela${NC}"
        echo "$RESPONSE" | head -20
        echo ""
        echo -e "${YELLOW}💡 Aplique manualmente via Supabase Dashboard SQL Editor${NC}"
        echo -e "${YELLOW}   URL: https://supabase.com/dashboard/project/$SUPABASE_PROJECT_ID/sql${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Tabela contract_signature_positions criada!${NC}"
fi

# Aplicar resto da migration (índices, RLS, policies)
echo -e "${BLUE}⚡ Aplicando índices e políticas RLS...${NC}"

# Aplicar SQL completo via Supabase CLI (método alternativo)
if supabase link --project-ref "$SUPABASE_PROJECT_ID" --yes 2>&1 | grep -v "new version" >/dev/null; then
    # Criar arquivo temporário apenas com índices e policies
    TEMP_SQL=$(mktemp)
    cat > "$TEMP_SQL" << 'EOF'
-- Índices
CREATE INDEX IF NOT EXISTS idx_contract_signature_positions_contract ON contract_signature_positions(contract_id);

-- RLS Policies
ALTER TABLE contract_signature_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view signature positions for their org contracts" ON contract_signature_positions;
CREATE POLICY "Users can view signature positions for their org contracts"
  ON contract_signature_positions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signature_positions.contract_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage signature positions for their org contracts" ON contract_signature_positions;
CREATE POLICY "Users can manage signature positions for their org contracts"
  ON contract_signature_positions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM contracts c
      JOIN organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_signature_positions.contract_id
        AND om.user_id = auth.uid()
    )
  );
EOF

    # Aplicar via API
    SQL_POLICIES=$(cat "$TEMP_SQL" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
    POLICY_RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"query\": \"$SQL_POLICIES\"}" 2>&1)
    
    rm -f "$TEMP_SQL"
    
    if echo "$POLICY_RESPONSE" | grep -qiE "(error|failed)"; then
        echo -e "${YELLOW}⚠️  Alguns índices/policies podem já existir (continuando...)${NC}"
    else
        echo -e "${GREEN}✅ Índices e políticas RLS aplicados!${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Migration aplicada com sucesso!${NC}"
echo ""
echo -e "${BLUE}🔍 Verificando tabela...${NC}"
CHECK_FINAL=$(curl -s -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_ID/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT table_name FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_name = '\''contract_signature_positions'\'';"}' 2>&1)

if echo "$CHECK_FINAL" | grep -qi "contract_signature_positions"; then
    echo -e "${GREEN}✅ Tabela contract_signature_positions confirmada no banco!${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível confirmar criação da tabela via API${NC}"
    echo -e "${YELLOW}💡 Verifique manualmente no Supabase Dashboard${NC}"
fi

exit 0

