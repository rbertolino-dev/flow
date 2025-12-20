-- ============================================
-- FIX: Verificar e corrigir módulo Pós-Venda (Post-Sale)
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
-- 2. Criar tabela post_sale_stages
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_sale_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_post_sale_stage_name_per_org UNIQUE(organization_id, name)
);

-- Índices para post_sale_stages
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_org ON public.post_sale_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_user ON public.post_sale_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_position ON public.post_sale_stages(organization_id, position);

-- ============================================
-- 3. Criar tabela post_sale_leads
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_sale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.post_sale_stages(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Índices para post_sale_leads
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_org ON public.post_sale_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_stage ON public.post_sale_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_user ON public.post_sale_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_phone ON public.post_sale_leads(phone);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_deleted ON public.post_sale_leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_original_lead ON public.post_sale_leads(original_lead_id);

-- ============================================
-- 4. Criar tabela post_sale_activities
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_sale_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'whatsapp', 'call', 'note', 'status_change'
  content TEXT NOT NULL,
  direction TEXT, -- 'incoming', 'outgoing'
  user_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para post_sale_activities
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_lead ON public.post_sale_activities(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_org ON public.post_sale_activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_created ON public.post_sale_activities(created_at DESC);

-- ============================================
-- 5. Criar tabela post_sale_lead_tags
-- ============================================
CREATE TABLE IF NOT EXISTS public.post_sale_lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_post_sale_lead_tag UNIQUE(post_sale_lead_id, tag_id)
);

-- Índices para post_sale_lead_tags
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_lead ON public.post_sale_lead_tags(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_tag ON public.post_sale_lead_tags(tag_id);

-- ============================================
-- 6. RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.post_sale_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_lead_tags ENABLE ROW LEVEL SECURITY;

-- Policies para post_sale_stages
DROP POLICY IF EXISTS "Users can view stages from their org" ON public.post_sale_stages;
CREATE POLICY "Users can view stages from their org"
  ON public.post_sale_stages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_stages.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can insert stages in their org"
  ON public.post_sale_stages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_stages.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can update stages in their org"
  ON public.post_sale_stages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_stages.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_stages.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete stages in their org" ON public.post_sale_stages;
CREATE POLICY "Users can delete stages in their org"
  ON public.post_sale_stages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_stages.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para post_sale_leads
DROP POLICY IF EXISTS "Users can view leads from their org" ON public.post_sale_leads;
CREATE POLICY "Users can view leads from their org"
  ON public.post_sale_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_leads.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can insert leads in their org"
  ON public.post_sale_leads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_leads.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can update leads in their org"
  ON public.post_sale_leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_leads.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_leads.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete leads in their org" ON public.post_sale_leads;
CREATE POLICY "Users can delete leads in their org"
  ON public.post_sale_leads FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_leads.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para post_sale_activities
DROP POLICY IF EXISTS "Users can view activities from their org" ON public.post_sale_activities;
CREATE POLICY "Users can view activities from their org"
  ON public.post_sale_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_activities.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert activities in their org" ON public.post_sale_activities;
CREATE POLICY "Users can insert activities in their org"
  ON public.post_sale_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_activities.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update activities in their org" ON public.post_sale_activities;
CREATE POLICY "Users can update activities in their org"
  ON public.post_sale_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_activities.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_activities.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete activities in their org" ON public.post_sale_activities;
CREATE POLICY "Users can delete activities in their org"
  ON public.post_sale_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = post_sale_activities.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- Policies para post_sale_lead_tags
DROP POLICY IF EXISTS "Users can view tags from their org" ON public.post_sale_lead_tags;
CREATE POLICY "Users can view tags from their org"
  ON public.post_sale_lead_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.post_sale_leads psl
      JOIN public.organization_members om ON om.organization_id = psl.organization_id
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert tags in their org" ON public.post_sale_lead_tags;
CREATE POLICY "Users can insert tags in their org"
  ON public.post_sale_lead_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.post_sale_leads psl
      JOIN public.organization_members om ON om.organization_id = psl.organization_id
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tags from their org" ON public.post_sale_lead_tags;
CREATE POLICY "Users can delete tags from their org"
  ON public.post_sale_lead_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.post_sale_leads psl
      JOIN public.organization_members om ON om.organization_id = psl.organization_id
      WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
        AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. Triggers para updated_at
-- ============================================

-- Trigger para post_sale_stages
DROP TRIGGER IF EXISTS update_post_sale_stages_updated_at ON public.post_sale_stages;
CREATE TRIGGER update_post_sale_stages_updated_at
  BEFORE UPDATE ON public.post_sale_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para post_sale_leads
DROP TRIGGER IF EXISTS update_post_sale_leads_updated_at ON public.post_sale_leads;
CREATE TRIGGER update_post_sale_leads_updated_at
  BEFORE UPDATE ON public.post_sale_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. Função para criar etapas padrão
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_post_sale_stages(
  p_org_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se já existem etapas para esta organização
  IF EXISTS (SELECT 1 FROM public.post_sale_stages WHERE organization_id = p_org_id) THEN
    RETURN;
  END IF;

  -- Criar etapas padrão
  INSERT INTO public.post_sale_stages (organization_id, user_id, name, color, position)
  VALUES
    (p_org_id, p_user_id, 'Novo Cliente', '#6366f1', 0),
    (p_org_id, p_user_id, 'Em Atendimento', '#8b5cf6', 1),
    (p_org_id, p_user_id, 'Resolvido', '#10b981', 2),
    (p_org_id, p_user_id, 'Fechado', '#6b7280', 3)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- ============================================
-- 9. Adicionar tabelas ao realtime (opcional)
-- ============================================
DO $$
BEGIN
  -- Tentar adicionar ao realtime (pode falhar se já existir)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_stages;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_leads;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_activities;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 10. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.post_sale_stages IS 'Etapas do funil de pós-venda (Kanban)';
COMMENT ON TABLE public.post_sale_leads IS 'Leads/clientes do módulo de pós-venda';
COMMENT ON TABLE public.post_sale_activities IS 'Atividades e histórico dos leads de pós-venda';
COMMENT ON TABLE public.post_sale_lead_tags IS 'Tags associadas aos leads de pós-venda';
COMMENT ON COLUMN public.post_sale_leads.original_lead_id IS 'Referência ao lead original do funil de vendas (se foi transferido)';
COMMENT ON COLUMN public.post_sale_leads.transferred_at IS 'Data/hora da transferência do lead de vendas para pós-venda';
COMMENT ON FUNCTION public.create_default_post_sale_stages IS 'Cria etapas padrão de pós-venda para uma organização';

-- ============================================
-- 11. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 12. Verificar resultado
-- ============================================
SELECT 
  'post_sale_stages' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_stages'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_stages' 
      AND column_name = 'position'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END as colunas
UNION ALL
SELECT 
  'post_sale_leads',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_leads'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_leads' 
      AND column_name = 'stage_id'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'post_sale_activities',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_activities'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_activities' 
      AND column_name = 'post_sale_lead_id'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'post_sale_lead_tags',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_lead_tags'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'post_sale_lead_tags' 
      AND column_name = 'tag_id'
  ) THEN '✅ Colunas OK' ELSE '❌ Colunas faltando' END
UNION ALL
SELECT 
  'create_default_post_sale_stages',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' 
      AND routine_name = 'create_default_post_sale_stages'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  'Função RPC' as colunas;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

