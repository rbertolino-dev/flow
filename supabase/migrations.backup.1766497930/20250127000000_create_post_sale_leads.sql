-- Criar tabela de leads de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value DECIMAL(10,2),
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  stage_id UUID REFERENCES public.post_sale_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  -- Referência ao lead original do funil de vendas (se foi transferido)
  original_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  transferred_by UUID REFERENCES public.profiles(id)
);

-- Criar tabela de etapas do funil de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_post_sale_stage_name_per_org UNIQUE(organization_id, name)
);

-- Criar tabela de atividades de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de tags de pós-venda (reutiliza a tabela tags existente via lead_tags)
CREATE TABLE IF NOT EXISTS public.post_sale_lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_sale_lead_id UUID NOT NULL REFERENCES public.post_sale_leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_sale_lead_id, tag_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_org_id ON public.post_sale_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_user_id ON public.post_sale_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_phone ON public.post_sale_leads(phone);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_stage_id ON public.post_sale_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_leads_deleted_at ON public.post_sale_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_post_sale_stages_org_id ON public.post_sale_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_activities_lead_id ON public.post_sale_activities(post_sale_lead_id);
CREATE INDEX IF NOT EXISTS idx_post_sale_lead_tags_lead_id ON public.post_sale_lead_tags(post_sale_lead_id);

-- Unique index para evitar duplicatas de telefone por organização (apenas leads ativos)
CREATE UNIQUE INDEX IF NOT EXISTS ux_post_sale_leads_org_phone_active
ON public.post_sale_leads (organization_id, phone)
WHERE deleted_at IS NULL;

-- Habilitar RLS
ALTER TABLE public.post_sale_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_lead_tags ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para post_sale_leads
CREATE POLICY "Users can view post sale leads of their organization"
ON public.post_sale_leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale leads for their organization"
ON public.post_sale_leads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update post sale leads of their organization"
ON public.post_sale_leads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale leads of their organization"
ON public.post_sale_leads FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_leads.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_stages
CREATE POLICY "Users can view post sale stages of their organization"
ON public.post_sale_stages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale stages for their organization"
ON public.post_sale_stages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update post sale stages of their organization"
ON public.post_sale_stages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale stages of their organization"
ON public.post_sale_stages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_stages.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_activities
CREATE POLICY "Users can view post sale activities of their organization"
ON public.post_sale_activities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_activities.organization_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale activities for their organization"
ON public.post_sale_activities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = post_sale_activities.organization_id
    AND om.user_id = auth.uid()
  )
);

-- Políticas RLS para post_sale_lead_tags
CREATE POLICY "Users can view post sale lead tags of their organization"
ON public.post_sale_lead_tags FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert post sale lead tags for their organization"
ON public.post_sale_lead_tags FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete post sale lead tags of their organization"
ON public.post_sale_lead_tags FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.post_sale_leads psl
    JOIN public.organization_members om ON om.organization_id = psl.organization_id
    WHERE psl.id = post_sale_lead_tags.post_sale_lead_id
    AND om.user_id = auth.uid()
  )
);

-- Trigger para normalizar telefone
CREATE OR REPLACE FUNCTION public.normalize_post_sale_lead_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := regexp_replace(NEW.phone, '\\D', '', 'g');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_post_sale_lead_phone_ins
BEFORE INSERT ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_post_sale_lead_phone();

CREATE TRIGGER trg_normalize_post_sale_lead_phone_upd
BEFORE UPDATE OF phone ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.normalize_post_sale_lead_phone();

-- Trigger para atualizar updated_at
CREATE TRIGGER update_post_sale_leads_updated_at
BEFORE UPDATE ON public.post_sale_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_post_sale_stages_updated_at
BEFORE UPDATE ON public.post_sale_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar etapas padrão de pós-venda
CREATE OR REPLACE FUNCTION public.create_default_post_sale_stages(p_org_id UUID, p_user_id UUID)
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
    (p_org_id, p_user_id, 'Novo Cliente', '#10b981', 0),
    (p_org_id, p_user_id, 'Ativação', '#3b82f6', 1),
    (p_org_id, p_user_id, 'Suporte', '#8b5cf6', 2),
    (p_org_id, p_user_id, 'Renovação', '#f59e0b', 3),
    (p_org_id, p_user_id, 'Fidelizado', '#22c55e', 4)
  ON CONFLICT (organization_id, name) DO NOTHING;
END;
$$;

-- Adicionar ao realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_stages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_sale_activities;

