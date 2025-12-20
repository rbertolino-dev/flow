-- Script para verificar se as migrações foram aplicadas
-- Execute este script no SQL Editor do Supabase

-- Verificar colunas em contract_signatures
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'contract_signatures' 
  AND column_name IN ('user_agent', 'device_info', 'geolocation', 'validation_hash', 'signed_ip_country')
ORDER BY column_name;

-- Verificar coluna em contracts
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'contracts' 
  AND column_name = 'whatsapp_message_template';

-- Verificar índice de validation_hash
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'contract_signatures'
  AND indexname = 'idx_contract_signatures_validation_hash';

-- Se as colunas não existirem, execute o script apply_new_migrations.sql

