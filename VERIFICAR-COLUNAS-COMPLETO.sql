-- Verificação completa das colunas de autenticação
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar colunas em contract_signatures
SELECT 
    'contract_signatures' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'contract_signatures' 
  AND column_name IN ('user_agent', 'device_info', 'geolocation', 'validation_hash', 'signed_ip_country')
ORDER BY column_name;

-- 2. Verificar coluna whatsapp_message_template em contracts
SELECT 
    'contracts' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'contracts' 
  AND column_name = 'whatsapp_message_template';

-- 3. Verificar índice
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'contract_signatures'
  AND indexname = 'idx_contract_signatures_validation_hash';

-- RESULTADO ESPERADO:
-- Deve retornar 5 linhas na primeira query (user_agent, device_info, geolocation, validation_hash, signed_ip_country)
-- Deve retornar 1 linha na segunda query (whatsapp_message_template)
-- Deve retornar 1 linha na terceira query (índice)

