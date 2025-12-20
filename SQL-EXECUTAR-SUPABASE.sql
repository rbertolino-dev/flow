-- ============================================
-- CORREÇÃO COMPLETA: Sistema de Contratos
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- 
-- Corrige:
-- 1. Erro 400 ao buscar cover_page_url (coluna não existe ou não reconhecida)
-- 2. Erro "Bucket not found" ao fazer upload de PDF
-- 3. Garante que todas as tabelas e configurações existem
-- ============================================

-- ============================================
-- PARTE 1: Garantir que tabela contract_templates existe
-- ============================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_contract_templates_org ON public.contract_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON public.contract_templates(organization_id, is_active);

-- ============================================
-- PARTE 2: Garantir coluna cover_page_url existe
-- ============================================
ALTER TABLE public.contract_templates
ADD COLUMN IF NOT EXISTS cover_page_url TEXT;

COMMENT ON COLUMN public.contract_templates.cover_page_url IS 'URL da imagem de folha de rosto (fundo) que será usada no PDF. Deve ter exatamente 210x297mm (A4) para encaixar 100%.';

-- ============================================
-- PARTE 3: Garantir bucket whatsapp-workflow-media existe
-- ============================================
DO $$
BEGIN
  -- Verificar se bucket existe, se não, criar
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'whatsapp-workflow-media'
  ) THEN
    -- Tentar criar bucket (pode falhar se não for super admin)
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'whatsapp-workflow-media',
        'whatsapp-workflow-media',
        true,
        16777216, -- 16MB
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo', 'application/pdf']
      );
      RAISE NOTICE '✅ Bucket whatsapp-workflow-media criado com sucesso';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '⚠️ Permissão insuficiente para criar bucket. Crie manualmente no Dashboard.';
        RAISE NOTICE '   Storage > New bucket > ID: whatsapp-workflow-media > Public: true';
      WHEN unique_violation THEN
        RAISE NOTICE '✅ Bucket já existe';
      WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao criar bucket: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '✅ Bucket whatsapp-workflow-media já existe';
  END IF;
END $$;

-- ============================================
-- PARTE 4: Adicionar application/pdf aos allowed_mime_types
-- ============================================
DO $$
DECLARE
  current_types TEXT[];
  has_pdf BOOLEAN;
BEGIN
  -- Obter tipos atuais
  SELECT COALESCE(allowed_mime_types, ARRAY[]::text[]) INTO current_types
  FROM storage.buckets
  WHERE id = 'whatsapp-workflow-media';
  
  -- Verificar se PDF já está incluído
  has_pdf := 'application/pdf' = ANY(current_types);
  
  IF NOT has_pdf THEN
    -- Tentar atualizar allowed_mime_types para incluir PDF
    BEGIN
      UPDATE storage.buckets
      SET allowed_mime_types = array_cat(
        current_types,
        ARRAY['application/pdf']
      )
      WHERE id = 'whatsapp-workflow-media';
      
      IF FOUND THEN
        RAISE NOTICE '✅ Bucket atualizado com sucesso para aceitar PDFs';
      ELSE
        RAISE NOTICE '⚠️ Bucket não foi atualizado.';
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE '⚠️ Permissão insuficiente. Execute manualmente no Supabase Dashboard.';
        RAISE NOTICE '   Storage > Settings > whatsapp-workflow-media > Allowed MIME types > Adicionar "application/pdf"';
      WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao atualizar bucket: %', SQLERRM;
        RAISE NOTICE '   Execute manualmente no Supabase Dashboard.';
    END;
  ELSE
    RAISE NOTICE '✅ PDF já está nos allowed_mime_types';
  END IF;
END $$;

-- ============================================
-- PARTE 5: Políticas RLS para upload de PDFs de contratos
-- ============================================

-- Política para permitir upload de PDFs de contratos
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
    OR name LIKE 'contracts/%'
  )
);

-- Política para permitir leitura pública de PDFs de contratos
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
    OR name LIKE 'contracts/%'
  )
);

-- Política para permitir atualização de PDFs de contratos (para PDFs assinados)
DROP POLICY IF EXISTS "Allow update contract PDFs" ON storage.objects;

CREATE POLICY "Allow update contract PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    name LIKE '%/contracts/%'
    OR name LIKE '%contracts/%'
    OR name LIKE 'contracts/%'
  )
);

-- ============================================
-- PARTE 6: Habilitar RLS nas tabelas de contratos (se necessário)
-- ============================================

-- Habilitar RLS em contract_templates
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS básicas se não existirem
DO $$
BEGIN
  -- Política de SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'contract_templates' 
    AND policyname = 'Users can view templates from their organization'
  ) THEN
    CREATE POLICY "Users can view templates from their organization"
    ON public.contract_templates FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = contract_templates.organization_id
          AND om.user_id = auth.uid()
      )
    );
  END IF;

  -- Política de INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'contract_templates' 
    AND policyname = 'Users can create templates in their organization'
  ) THEN
    CREATE POLICY "Users can create templates in their organization"
    ON public.contract_templates FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = contract_templates.organization_id
          AND om.user_id = auth.uid()
      )
    );
  END IF;

  -- Política de UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'contract_templates' 
    AND policyname = 'Users can update templates in their organization'
  ) THEN
    CREATE POLICY "Users can update templates in their organization"
    ON public.contract_templates FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = contract_templates.organization_id
          AND om.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================
-- PARTE 7: Recarregar cache do PostgREST
-- ============================================
-- Isso garante que a coluna cover_page_url seja reconhecida pela API REST
NOTIFY pgrst, 'reload schema';

-- ============================================
-- FIM DA CORREÇÃO
-- ============================================
-- 
-- Após executar:
-- 1. Execute VERIFICAR-CONTRATOS-SETUP.sql para verificar se tudo está OK
-- 2. Se a atualização do bucket falhar (erro de permissão), faça manualmente:
--    - Acesse: Supabase Dashboard > Storage > Settings
--    - Selecione o bucket "whatsapp-workflow-media"
--    - Em "Allowed MIME types", adicione: "application/pdf"
--    - Salve
-- 3. Teste criando um contrato para verificar se o PDF é gerado e enviado corretamente
-- ============================================

