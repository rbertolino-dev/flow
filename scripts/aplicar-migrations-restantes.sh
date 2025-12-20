#!/bin/bash

# Script para aplicar migrations que faltam
# Resolve o problema de migrations já aplicadas manualmente

set -e

export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

cd /root/kanban-buzz-95241

echo "🔍 Verificando migrations aplicadas..."

# Lista de migrations que precisam ser marcadas como aplicadas
MIGRATIONS_PARA_MARCAR=(
  "20250122000000"
  "20250123000000"
  "20250123000001"
  "20250124000000"
  "20250125000000"
  "20250126000000"
  "20250128000000"
  "20250131000003"
  "20250131000004"
)

echo "📝 Marcando migrations já aplicadas manualmente..."

# Criar SQL temporário para marcar migrations
SQL_TEMP=$(mktemp)
cat > "$SQL_TEMP" <<EOF
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES 
  ('20250122000000', 'create_follow_up_templates', '[]'::jsonb),
  ('20250123000000', 'add_status_to_calendar_events', '[]'::jsonb),
  ('20250123000001', 'add_mercado_pago_payments', '[]'::jsonb),
  ('20250124000000', 'create_facebook_configs', '[]'::jsonb),
  ('20250124000000', 'create_form_builders', '[]'::jsonb),
  ('20250125000000', 'create_facebook_configs', '[]'::jsonb),
  ('20250126000000', 'create_google_business_tables', '[]'::jsonb),
  ('20250128000000', 'create_whatsapp_status_posts', '[]'::jsonb),
  ('20250131000003', 'create_evolution_providers', '[]'::jsonb),
  ('20250131000004', 'secure_evolution_providers', '[]'::jsonb)
ON CONFLICT (version) DO NOTHING;
EOF

# Aplicar via supabase db execute (se disponível) ou pedir para executar manualmente
echo "⚠️  Execute este SQL no Supabase SQL Editor:"
echo ""
cat "$SQL_TEMP"
echo ""
echo "Depois pressione Enter para continuar..."
read

rm "$SQL_TEMP"

echo "🚀 Aplicando migrations restantes..."
supabase db push --include-all --yes

echo "✅ Concluído!"



