-- Marcar migrations que já foram aplicadas manualmente como registradas
-- Versão corrigida: verifica se já existe antes de inserir

-- Primeiro, verificar quais já existem
DO $$
DECLARE
  migration_version TEXT;
  migration_name TEXT;
  migrations_to_mark TEXT[][] := ARRAY[
    ['20250122000000', 'create_follow_up_templates'],
    ['20250123000000', 'add_status_to_calendar_events'],
    ['20250123000001', 'add_mercado_pago_payments'],
    ['20250124000000', 'create_facebook_configs'],
    ['20250124000000', 'create_form_builders'],
    ['20250125000000', 'create_facebook_configs'],
    ['20250126000000', 'create_google_business_tables'],
    ['20250128000000', 'create_whatsapp_status_posts'],
    ['20250131000003', 'create_evolution_providers'],
    ['20250131000004', 'secure_evolution_providers']
  ];
  migration_record TEXT[];
BEGIN
  FOREACH migration_record SLICE 1 IN ARRAY migrations_to_mark
  LOOP
    migration_version := migration_record[1];
    migration_name := migration_record[2];
    
    -- Inserir apenas se não existir
    INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
    VALUES (migration_version, migration_name, ARRAY[]::text[])
    ON CONFLICT (version) DO NOTHING;
    
    RAISE NOTICE 'Migration % marcada como aplicada', migration_version;
  END LOOP;
END $$;

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


