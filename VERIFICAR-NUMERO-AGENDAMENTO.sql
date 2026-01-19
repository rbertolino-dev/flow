-- ============================================
-- Verificar números salvos em scheduled_messages
-- ============================================
-- Execute este SQL no Supabase SQL Editor para verificar
-- como os números estão sendo salvos no banco

-- Ver últimas mensagens agendadas
SELECT 
  id,
  organization_id,
  phone,
  LENGTH(phone) as phone_length,
  phone LIKE '%@%' as has_at_symbol,
  phone LIKE '%55%' as has_country_code,
  scheduled_for,
  status,
  error_message,
  created_at
FROM scheduled_messages
ORDER BY created_at DESC
LIMIT 10;

-- Verificar se há números sem código do país
SELECT 
  id,
  phone,
  CASE 
    WHEN phone LIKE '%@%' THEN SPLIT_PART(phone, '@', 1)
    ELSE phone
  END as phone_clean,
  CASE 
    WHEN phone LIKE '%@%' THEN SPLIT_PART(phone, '@', 1)
    ELSE phone
  END ~ '^[0-9]+$' as is_numeric,
  LENGTH(REGEXP_REPLACE(
    CASE 
      WHEN phone LIKE '%@%' THEN SPLIT_PART(phone, '@', 1)
      ELSE phone
    END,
    '[^0-9]', '', 'g'
  )) as numeric_length,
  CASE 
    WHEN phone LIKE '%@%' THEN SPLIT_PART(phone, '@', 1)
    ELSE phone
  END ~ '^55' as starts_with_55
FROM scheduled_messages
WHERE status = 'pending'
  OR status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
