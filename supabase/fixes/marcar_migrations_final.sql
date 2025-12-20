-- Marcar migrations que já foram aplicadas manualmente como registradas
-- Versão final: trata duplicatas e conflitos

-- Deletar registros duplicados primeiro (se houver)
DELETE FROM supabase_migrations.schema_migrations 
WHERE version IN (
  '20250122000000',
  '20250123000000',
  '20250123000001',
  '20250124000000',
  '20250125000000',
  '20250126000000',
  '20250128000000',
  '20250131000003',
  '20250131000004'
);

-- Inserir novamente (apenas uma versão de cada timestamp)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES 
  ('20250122000000', 'create_follow_up_templates', ARRAY[]::text[]),
  ('20250123000000', 'add_status_to_calendar_events', ARRAY[]::text[]),
  ('20250123000001', 'add_mercado_pago_payments', ARRAY[]::text[]),
  ('20250124000000', 'create_facebook_configs', ARRAY[]::text[]),
  -- Nota: create_form_builders também tem timestamp 20250124000000, mas vamos marcar apenas uma
  ('20250125000000', 'create_facebook_configs', ARRAY[]::text[]),
  ('20250126000000', 'create_google_business_tables', ARRAY[]::text[]),
  ('20250128000000', 'create_whatsapp_status_posts', ARRAY[]::text[]),
  ('20250131000003', 'create_evolution_providers', ARRAY[]::text[]),
  ('20250131000004', 'secure_evolution_providers', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- Verificar resultado
SELECT version, name 
FROM supabase_migrations.schema_migrations 
WHERE version IN (
  '20250122000000',
  '20250123000000',
  '20250123000001',
  '20250124000000',
  '20250125000000',
  '20250126000000',
  '20250128000000',
  '20250131000003',
  '20250131000004'
)
ORDER BY version;


