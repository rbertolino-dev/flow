-- ============================================
-- FIX: Criar tabelas faltantes para Super Admin
-- Execute no Supabase SQL Editor
-- ============================================
-- Este script cria todas as tabelas e funções necessárias para o painel Super Admin

-- ============================================
-- 0. Garantir função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. Tabela lead_tags (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'lead_tags'
  ) THEN
    CREATE TABLE public.lead_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(lead_id, tag_id)
    );

    CREATE INDEX idx_lead_tags_lead_id ON public.lead_tags(lead_id);
    CREATE INDEX idx_lead_tags_tag_id ON public.lead_tags(tag_id);

    ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS básicas
    CREATE POLICY "Users can view lead_tags of their organization leads"
    ON public.lead_tags
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_tags.lead_id
        AND l.organization_id = public.get_user_organization(auth.uid())
      )
    );

    CREATE POLICY "Users can insert lead_tags for their organization leads"
    ON public.lead_tags
    FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_tags.lead_id
        AND l.organization_id = public.get_user_organization(auth.uid())
      )
    );

    CREATE POLICY "Users can delete lead_tags from their organization leads"
    ON public.lead_tags
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_tags.lead_id
        AND l.organization_id = public.get_user_organization(auth.uid())
      )
    );

    -- Super admins podem ver tudo
    CREATE POLICY "Super admins can view all lead_tags"
    ON public.lead_tags
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- ============================================
-- 2. Tabela message_templates (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'message_templates'
  ) THEN
    CREATE TABLE public.message_templates (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL,
      organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_message_templates_user_id ON public.message_templates(user_id);
    CREATE INDEX idx_message_templates_org_id ON public.message_templates(organization_id);

    ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS básicas
    CREATE POLICY "Users can view their own templates"
    ON public.message_templates
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own templates"
    ON public.message_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own templates"
    ON public.message_templates
    FOR UPDATE
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own templates"
    ON public.message_templates
    FOR DELETE
    USING (auth.uid() = user_id);

    -- Super admins podem ver tudo
    CREATE POLICY "Super admins can view all message_templates"
    ON public.message_templates
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    -- Trigger para updated_at
    CREATE TRIGGER update_message_templates_updated_at
    BEFORE UPDATE ON public.message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 3. Tabela instance_groups (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'instance_groups'
  ) THEN
    CREATE TABLE public.instance_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      instance_ids UUID[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX idx_instance_groups_org ON public.instance_groups(organization_id);

    ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS
    CREATE POLICY "Users can view instance groups of their organization"
    ON public.instance_groups
    FOR SELECT
    USING (
      organization_id = get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can create instance groups for their organization"
    ON public.instance_groups
    FOR INSERT
    WITH CHECK (
      organization_id = get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can update instance groups of their organization"
    ON public.instance_groups
    FOR UPDATE
    USING (
      organization_id = get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can delete instance groups of their organization"
    ON public.instance_groups
    FOR DELETE
    USING (
      organization_id = get_user_organization(auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    -- Trigger para updated_at (usando função global update_updated_at_column)
    CREATE TRIGGER update_instance_groups_updated_at
    BEFORE UPDATE ON public.instance_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 4. Tabela broadcast_campaigns (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
  ) THEN
    CREATE TABLE public.broadcast_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      message_template_id UUID REFERENCES public.message_templates(id),
      custom_message TEXT,
      instance_id UUID REFERENCES public.evolution_config(id) NOT NULL,
      min_delay_seconds INTEGER NOT NULL DEFAULT 30,
      max_delay_seconds INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'draft',
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      CONSTRAINT valid_status CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
    );

    CREATE INDEX idx_broadcast_campaigns_user_id ON public.broadcast_campaigns(user_id);
    CREATE INDEX idx_broadcast_campaigns_org_id ON public.broadcast_campaigns(organization_id);

    ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS básicas
    CREATE POLICY "Users can view their own campaigns"
    ON public.broadcast_campaigns
    FOR SELECT
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can create their own campaigns"
    ON public.broadcast_campaigns
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update their own campaigns"
    ON public.broadcast_campaigns
    FOR UPDATE
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own campaigns"
    ON public.broadcast_campaigns
    FOR DELETE
    USING (auth.uid() = user_id);

    -- Super admins podem ver tudo
    CREATE POLICY "Super admins can view all broadcast_campaigns"
    ON public.broadcast_campaigns
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );
  END IF;
END $$;

-- ============================================
-- 5. Tabela broadcast_time_windows (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_time_windows'
  ) THEN
    CREATE TABLE public.broadcast_time_windows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      monday_start TIME,
      monday_end TIME,
      tuesday_start TIME,
      tuesday_end TIME,
      wednesday_start TIME,
      wednesday_end TIME,
      thursday_start TIME,
      thursday_end TIME,
      friday_start TIME,
      friday_end TIME,
      saturday_start TIME,
      saturday_end TIME,
      sunday_start TIME,
      sunday_end TIME,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(organization_id, name)
    );

    CREATE INDEX idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
    CREATE INDEX idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled) WHERE enabled = true;

    ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS
    CREATE POLICY "Users can view time windows of their organization"
    ON public.broadcast_time_windows
    FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can create time windows for their organization"
    ON public.broadcast_time_windows
    FOR INSERT
    WITH CHECK (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can update time windows of their organization"
    ON public.broadcast_time_windows
    FOR UPDATE
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    CREATE POLICY "Users can delete time windows of their organization"
    ON public.broadcast_time_windows
    FOR DELETE
    USING (
      organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    -- Trigger para updated_at (usando função global update_updated_at_column)
    CREATE TRIGGER update_broadcast_time_windows_updated_at
    BEFORE UPDATE ON public.broadcast_time_windows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 6. Tabela broadcast_campaign_templates (se não existir)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaign_templates'
  ) THEN
    CREATE TABLE public.broadcast_campaign_templates (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL,
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      instance_id UUID,
      instance_name TEXT,
      message_template_id UUID,
      custom_message TEXT,
      min_delay_seconds INTEGER NOT NULL DEFAULT 30,
      max_delay_seconds INTEGER NOT NULL DEFAULT 60,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_broadcast_campaign_templates_org_id ON public.broadcast_campaign_templates(organization_id);

    ALTER TABLE public.broadcast_campaign_templates ENABLE ROW LEVEL SECURITY;

    -- Políticas RLS
    CREATE POLICY "Users can view organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR SELECT
    USING (organization_id = get_user_organization(auth.uid()));

    CREATE POLICY "Users can create organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR INSERT
    WITH CHECK (organization_id = get_user_organization(auth.uid()));

    CREATE POLICY "Users can update organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR UPDATE
    USING (organization_id = get_user_organization(auth.uid()));

    CREATE POLICY "Users can delete organization campaign templates"
    ON public.broadcast_campaign_templates
    FOR DELETE
    USING (organization_id = get_user_organization(auth.uid()));

    -- Super admins podem ver tudo
    CREATE POLICY "Super admins can view all campaign templates"
    ON public.broadcast_campaign_templates
    FOR SELECT
    USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_pubdigital_user(auth.uid())
    );

    -- Trigger para updated_at
    CREATE TRIGGER update_broadcast_campaign_templates_updated_at
    BEFORE UPDATE ON public.broadcast_campaign_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 7. Função get_all_organizations_with_members
-- ============================================
CREATE OR REPLACE FUNCTION public.get_all_organizations_with_members()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_created_at timestamptz,
  org_plan_id uuid,
  member_user_id uuid,
  member_role text,
  member_created_at timestamptz,
  member_email text,
  member_full_name text,
  member_roles jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id as org_id,
    o.name as org_name,
    o.created_at as org_created_at,
    ol.plan_id as org_plan_id,
    om.user_id as member_user_id,
    om.role as member_role,
    om.created_at as member_created_at,
    p.email as member_email,
    p.full_name as member_full_name,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role', ur.role))
      FROM user_roles ur
      WHERE ur.user_id = om.user_id
    ), '[]'::jsonb) as member_roles
  FROM organizations o
  LEFT JOIN organization_limits ol ON ol.organization_id = o.id
  LEFT JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN profiles p ON p.id = om.user_id
  ORDER BY o.created_at DESC;
$$;

-- ============================================
-- 8. Garantir que facebook_configs tem RLS adequado
-- ============================================
DO $$
BEGIN
  -- Verificar se tabela existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'facebook_configs'
  ) THEN
    -- Adicionar policy para super admins se não existir
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'facebook_configs'
        AND policyname = 'Super admins can view all facebook_configs'
    ) THEN
      CREATE POLICY "Super admins can view all facebook_configs"
      ON public.facebook_configs
      FOR SELECT
      USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR is_pubdigital_user(auth.uid())
      );
    END IF;
  END IF;
END $$;

-- ============================================
-- 9. Verificar resultado
-- ============================================
SELECT 
  'lead_tags' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lead_tags'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'message_templates',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_templates'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'instance_groups',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'instance_groups'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'broadcast_campaigns',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_campaigns'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'broadcast_time_windows',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_time_windows'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'broadcast_campaign_templates',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'broadcast_campaign_templates'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END
UNION ALL
SELECT 
  'get_all_organizations_with_members',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_all_organizations_with_members'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Após executar, recarregue a página do Super Admin
