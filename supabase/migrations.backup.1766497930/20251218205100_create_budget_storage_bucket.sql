-- Migration: Criar bucket de storage para PDFs de orçamentos
-- Data: 2025-12-18

-- Criar bucket budget-pdfs se não existir
-- NOTA: Pode falhar se não for super admin - criar manualmente no Dashboard se necessário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'budget-pdfs'
  ) THEN
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'budget-pdfs',
        'budget-pdfs',
        true,
        52428800, -- 50MB
        ARRAY['application/pdf']
      );
      RAISE NOTICE '✅ Bucket budget-pdfs criado com sucesso';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '⚠️ Permissão insuficiente para criar bucket. Crie manualmente no Dashboard.';
        RAISE NOTICE '   Storage > New bucket > ID: budget-pdfs > Public: true > Allowed MIME types: application/pdf';
      WHEN unique_violation THEN
        RAISE NOTICE '✅ Bucket já existe';
      WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao criar bucket: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '✅ Bucket budget-pdfs já existe';
  END IF;
END $$;

-- Criar políticas RLS para o bucket budget-pdfs
-- Política 1: SELECT (leitura) - Público para permitir acesso aos PDFs
DROP POLICY IF EXISTS "Public read access to budget PDFs" ON storage.objects;
CREATE POLICY "Public read access to budget PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'budget-pdfs');

-- Política 2: INSERT (upload) - Autenticados podem fazer upload
DROP POLICY IF EXISTS "Authenticated users can upload budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can upload budget PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'budget-pdfs');

-- Política 3: UPDATE (atualizar) - Autenticados podem atualizar
DROP POLICY IF EXISTS "Authenticated users can update budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can update budget PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'budget-pdfs')
WITH CHECK (bucket_id = 'budget-pdfs');

-- Política 4: DELETE (excluir) - Autenticados podem excluir
DROP POLICY IF EXISTS "Authenticated users can delete budget PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can delete budget PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'budget-pdfs');

