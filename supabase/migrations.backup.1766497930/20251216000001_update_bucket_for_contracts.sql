-- Atualizar bucket para aceitar PDFs de contratos
-- NOTA: Esta migração pode falhar se você não for super admin do Supabase
-- Se receber erro de permissão, faça manualmente no Supabase Dashboard:
-- 
-- Opção 1 (Recomendado): Via Dashboard
-- 1. Acesse: Supabase Dashboard > Storage > Settings
-- 2. Selecione o bucket "whatsapp-workflow-media"
-- 3. Em "Allowed MIME types", adicione: application/pdf
-- 4. Salve
--
-- Opção 2: Via SQL (requer super admin)
-- Execute no SQL Editor do Supabase como super admin:
-- UPDATE storage.buckets
-- SET allowed_mime_types = array_cat(
--   COALESCE(allowed_mime_types, ARRAY[]::text[]),
--   ARRAY['application/pdf']
-- )
-- WHERE id = 'whatsapp-workflow-media';

-- Tentar atualizar o bucket (pode falhar se não for super admin)
DO $$
BEGIN
  -- Tentar atualizar allowed_mime_types
  UPDATE storage.buckets
  SET allowed_mime_types = array_cat(
    COALESCE(allowed_mime_types, ARRAY[]::text[]),
    ARRAY['application/pdf']
  )
  WHERE id = 'whatsapp-workflow-media'
  AND NOT ('application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
  
  IF FOUND THEN
    RAISE NOTICE '✅ Bucket atualizado com sucesso para aceitar PDFs';
  ELSE
    RAISE NOTICE '⚠️ Bucket não foi atualizado. Execute manualmente no Dashboard.';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Permissão insuficiente. Execute manualmente no Supabase Dashboard.';
    RAISE NOTICE '   Storage > Settings > whatsapp-workflow-media > Allowed MIME types > Adicionar "application/pdf"';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Erro ao atualizar bucket: %', SQLERRM;
    RAISE NOTICE '   Execute manualmente no Supabase Dashboard.';
END $$;

-- Criar política adicional para garantir que PDFs de contratos sejam permitidos
-- Esta política funciona como fallback e permite uploads mesmo se o bucket não tiver application/pdf
DROP POLICY IF EXISTS "Allow PDF uploads for contracts" ON storage.objects;

CREATE POLICY "Allow PDF uploads for contracts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    -- Permitir arquivos na pasta contracts/
    name LIKE '%/contracts/%'
    OR name LIKE '%contracts/%'
  )
);

-- Garantir que a política de leitura pública também funcione para PDFs
-- (já existe, mas garantindo que está correta)
DROP POLICY IF EXISTS "Allow public read access to contract PDFs" ON storage.objects;

CREATE POLICY "Allow public read access to contract PDFs"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    name LIKE '%/contracts/%'
    OR name LIKE '%contracts/%'
  )
);
