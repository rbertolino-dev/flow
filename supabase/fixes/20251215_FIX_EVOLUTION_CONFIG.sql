-- ============================================
-- FIX: Verificar e corrigir tabela evolution_config
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Criar tabela evolution_config se não existir
-- ============================================
CREATE TABLE IF NOT EXISTS public.evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_key TEXT,
  is_connected BOOLEAN DEFAULT false,
  qr_code TEXT,
  phone_number TEXT,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_secret TEXT,
  sync_method TEXT,
  sync_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. Adicionar colunas faltantes se não existirem
-- ============================================
ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS sync_method TEXT,
  ADD COLUMN IF NOT EXISTS sync_path TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill organization_id de user_id se necessário
DO $$
BEGIN
  -- Atualizar organization_id para registros que não têm
  UPDATE public.evolution_config ec
  SET organization_id = (
    SELECT om.organization_id
    FROM public.organization_members om
    WHERE om.user_id = ec.user_id
    ORDER BY om.created_at ASC
    LIMIT 1
  )
  WHERE ec.organization_id IS NULL;
END $$;

-- ============================================
-- 4. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_evolution_config_user_id ON public.evolution_config(user_id);
CREATE INDEX IF NOT EXISTS idx_evolution_config_org ON public.evolution_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_evolution_config_org_connected ON public.evolution_config(organization_id, is_connected) WHERE is_connected = true;

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

-- Policies para evolution_config
DROP POLICY IF EXISTS "Users can view configs from their org" ON public.evolution_config;
CREATE POLICY "Users can view configs from their org"
  ON public.evolution_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = evolution_config.organization_id
        AND om.user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Permitir ver suas próprias instâncias (backward compatibility)
  );

DROP POLICY IF EXISTS "Users can insert configs in their org" ON public.evolution_config;
CREATE POLICY "Users can insert configs in their org"
  ON public.evolution_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = evolution_config.organization_id
        AND om.user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Permitir criar suas próprias instâncias (backward compatibility)
  );

DROP POLICY IF EXISTS "Users can update configs in their org" ON public.evolution_config;
CREATE POLICY "Users can update configs in their org"
  ON public.evolution_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = evolution_config.organization_id
        AND om.user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Permitir atualizar suas próprias instâncias (backward compatibility)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = evolution_config.organization_id
        AND om.user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Permitir atualizar suas próprias instâncias (backward compatibility)
  );

DROP POLICY IF EXISTS "Users can delete configs in their org" ON public.evolution_config;
CREATE POLICY "Users can delete configs in their org"
  ON public.evolution_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = evolution_config.organization_id
        AND om.user_id = auth.uid()
    )
    OR user_id = auth.uid() -- Permitir deletar suas próprias instâncias (backward compatibility)
  );

-- ============================================
-- 6. Triggers para updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_evolution_config_updated_at ON public.evolution_config;
CREATE TRIGGER update_evolution_config_updated_at
  BEFORE UPDATE ON public.evolution_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. Adicionar tabela ao realtime (opcional)
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.evolution_config;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 8. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.evolution_config IS 'Configurações das instâncias WhatsApp (Evolution API)';
COMMENT ON COLUMN public.evolution_config.organization_id IS 'Organização à qual a instância pertence';
COMMENT ON COLUMN public.evolution_config.is_connected IS 'Indica se a instância está conectada ao WhatsApp';
COMMENT ON COLUMN public.evolution_config.webhook_enabled IS 'Indica se o webhook está habilitado para esta instância';

-- ============================================
-- 9. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 10. Verificar resultado
-- ============================================
SELECT 
  'evolution_config' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_config'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_config' 
      AND column_name = 'organization_id'
  ) THEN '✅ organization_id OK' ELSE '❌ organization_id faltando' END as organization_id
UNION ALL
SELECT 
  'evolution_config',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_config'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_config' 
      AND column_name = 'is_connected'
  ) THEN '✅ is_connected OK' ELSE '❌ is_connected faltando' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

