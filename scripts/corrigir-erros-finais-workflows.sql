-- ==========================================
-- CORREÇÃO FINAL: Erros restantes de workflows
-- ==========================================
-- Execute este script no Supabase SQL Editor
-- https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

-- ==========================================
-- PARTE 1: Garantir que colunas media_url e media_type existem em message_templates
-- ==========================================

DO $$
BEGIN
  -- Adicionar coluna media_type se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'message_templates'
    AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.message_templates
    ADD COLUMN media_type TEXT CHECK (media_type IN ('image', 'video', 'document'));
    
    COMMENT ON COLUMN public.message_templates.media_type IS 'Tipo de mídia: image, video, document';
  END IF;
  
  -- Adicionar coluna media_url se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'message_templates'
    AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.message_templates
    ADD COLUMN media_url TEXT;
    
    COMMENT ON COLUMN public.message_templates.media_url IS 'URL da mídia anexada ao template';
  END IF;
END $$;

-- ==========================================
-- PARTE 2: Garantir que função is_pubdigital_user está exposta como RPC
-- ==========================================

-- A função já existe, mas precisa estar acessível via RPC
-- Verificar se está no schema public e tem permissões corretas
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pubdigital_user(UUID) TO anon;

-- ==========================================
-- PARTE 3: Forçar atualização do schema cache do Supabase
-- ==========================================

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';

-- Aguardar um pouco para garantir que o schema foi atualizado
SELECT pg_sleep(1);

-- ==========================================
-- PARTE 4: Verificação final
-- ==========================================

DO $$
BEGIN
  -- Verificar colunas em message_templates
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'message_templates'
    AND column_name = 'media_type'
  ) THEN
    RAISE EXCEPTION 'Coluna media_type não existe em message_templates!';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'message_templates'
    AND column_name = 'media_url'
  ) THEN
    RAISE EXCEPTION 'Coluna media_url não existe em message_templates!';
  END IF;
  
  -- Verificar função is_pubdigital_user
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_pubdigital_user'
  ) THEN
    RAISE EXCEPTION 'Função is_pubdigital_user não foi criada!';
  END IF;
  
  RAISE NOTICE '✅ Todas as verificações passaram!';
  RAISE NOTICE '✅ Colunas media_type e media_url adicionadas em message_templates';
  RAISE NOTICE '✅ Permissões RPC configuradas para is_pubdigital_user';
  RAISE NOTICE '✅ Schema cache será atualizado automaticamente';
END $$;

