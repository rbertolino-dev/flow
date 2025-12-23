-- Criar tabela de organizações
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Criar tabela de membros de organizações
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Função para obter a organização do usuário
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = _user_id 
  LIMIT 1;
$$;

-- Função para verificar se usuário pertence à organização
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = _user_id 
    AND organization_id = _org_id
  );
$$;

-- Policies para organizations
CREATE POLICY "Users can view their organization"
ON public.organizations
FOR SELECT
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update"
ON public.organizations
FOR UPDATE
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
  )
);

-- Policies para organization_members
CREATE POLICY "Users can view members of their organization"
ON public.organization_members
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners and admins can manage members"
ON public.organization_members
FOR ALL
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Adicionar organization_id às tabelas principais
ALTER TABLE public.leads ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tags ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.message_templates ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.evolution_config ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.broadcast_campaigns ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_lid_contacts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.international_contacts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_queue ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.call_queue_history ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Criar índices para performance
DROP INDEX IF EXISTS idx_org_members_user CASCADE;
CREATE INDEX idx_org_members_user ON
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
DROP INDEX IF EXISTS idx_org_members_org CASCADE;
CREATE INDEX idx_org_members_org ON
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
DROP INDEX IF EXISTS idx_leads_org CASCADE;
CREATE INDEX idx_leads_org ON
CREATE INDEX idx_leads_org ON public.leads(organization_id);
DROP INDEX IF EXISTS idx_pipeline_stages_org CASCADE;
CREATE INDEX idx_pipeline_stages_org ON
CREATE INDEX idx_pipeline_stages_org ON public.pipeline_stages(organization_id);
DROP INDEX IF EXISTS idx_tags_org CASCADE;
CREATE INDEX idx_tags_org ON
CREATE INDEX idx_tags_org ON public.tags(organization_id);

-- Atualizar função handle_new_user para criar organização automática
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Criar organização para o novo usuário
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' - Empresa')
  RETURNING id INTO new_org_id;
  
  -- Adicionar usuário como owner da organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  -- Inserir perfil
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Inserir role padrão de usuário
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Atualizar RLS policies das tabelas principais para usar organization_id

-- Leads
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

CREATE POLICY "Users can view organization leads"
ON public.leads FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization leads"
ON public.leads FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization leads"
ON public.leads FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization leads"
ON public.leads FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Pipeline Stages
DROP POLICY IF EXISTS "Users can view their own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can create their own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can update their own pipeline stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Users can delete their own pipeline stages" ON public.pipeline_stages;

CREATE POLICY "Users can view organization pipeline stages"
ON public.pipeline_stages FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization pipeline stages"
ON public.pipeline_stages FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization pipeline stages"
ON public.pipeline_stages FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization pipeline stages"
ON public.pipeline_stages FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Tags
DROP POLICY IF EXISTS "Users can view their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can create their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update their own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete their own tags" ON public.tags;

CREATE POLICY "Users can view organization tags"
ON public.tags FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization tags"
ON public.tags FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization tags"
ON public.tags FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization tags"
ON public.tags FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Message Templates
DROP POLICY IF EXISTS "Users can view their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can create their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON public.message_templates;

CREATE POLICY "Users can view organization templates"
ON public.message_templates FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization templates"
ON public.message_templates FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization templates"
ON public.message_templates FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization templates"
ON public.message_templates FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Evolution Config
DROP POLICY IF EXISTS "Users can view their own config" ON public.evolution_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON public.evolution_config;
DROP POLICY IF EXISTS "Users can update their own config" ON public.evolution_config;
DROP POLICY IF EXISTS "Users can delete their own config" ON public.evolution_config;

CREATE POLICY "Users can view organization config"
ON public.evolution_config FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization config"
ON public.evolution_config FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization config"
ON public.evolution_config FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization config"
ON public.evolution_config FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Broadcast Campaigns
DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.broadcast_campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.broadcast_campaigns;

CREATE POLICY "Users can view organization campaigns"
ON public.broadcast_campaigns FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization campaigns"
ON public.broadcast_campaigns FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization campaigns"
ON public.broadcast_campaigns FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization campaigns"
ON public.broadcast_campaigns FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Scheduled Messages
DROP POLICY IF EXISTS "Users can view their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete their own scheduled messages" ON public.scheduled_messages;

CREATE POLICY "Users can view organization scheduled messages"
ON public.scheduled_messages FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization scheduled messages"
ON public.scheduled_messages FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization scheduled messages"
ON public.scheduled_messages FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization scheduled messages"
ON public.scheduled_messages FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- WhatsApp Messages
DROP POLICY IF EXISTS "Users can view their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.whatsapp_messages;

CREATE POLICY "Users can view organization messages"
ON public.whatsapp_messages FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization messages"
ON public.whatsapp_messages FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization messages"
ON public.whatsapp_messages FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization messages"
ON public.whatsapp_messages FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- WhatsApp LID Contacts
DROP POLICY IF EXISTS "Users can view their own LID contacts" ON public.whatsapp_lid_contacts;
DROP POLICY IF EXISTS "Users can insert their own LID contacts" ON public.whatsapp_lid_contacts;
DROP POLICY IF EXISTS "Users can update their own LID contacts" ON public.whatsapp_lid_contacts;
DROP POLICY IF EXISTS "Users can delete their own LID contacts" ON public.whatsapp_lid_contacts;

CREATE POLICY "Users can view organization LID contacts"
ON public.whatsapp_lid_contacts FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization LID contacts"
ON public.whatsapp_lid_contacts FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization LID contacts"
ON public.whatsapp_lid_contacts FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization LID contacts"
ON public.whatsapp_lid_contacts FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- International Contacts
DROP POLICY IF EXISTS "Users can view their own international contacts" ON public.international_contacts;
DROP POLICY IF EXISTS "Users can insert their own international contacts" ON public.international_contacts;
DROP POLICY IF EXISTS "Users can update their own international contacts" ON public.international_contacts;
DROP POLICY IF EXISTS "Users can delete their own international contacts" ON public.international_contacts;

CREATE POLICY "Users can view organization international contacts"
ON public.international_contacts FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization international contacts"
ON public.international_contacts FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization international contacts"
ON public.international_contacts FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization international contacts"
ON public.international_contacts FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Call Queue
DROP POLICY IF EXISTS "Users can view their own call queue" ON public.call_queue;
DROP POLICY IF EXISTS "Users can insert into their call queue" ON public.call_queue;
DROP POLICY IF EXISTS "Users can update their call queue" ON public.call_queue;
DROP POLICY IF EXISTS "Users can delete their call queue" ON public.call_queue;

CREATE POLICY "Users can view organization call queue"
ON public.call_queue FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization call queue"
ON public.call_queue FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization call queue"
ON public.call_queue FOR UPDATE
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization call queue"
ON public.call_queue FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Call Queue History
DROP POLICY IF EXISTS "Users can view their own call queue history" ON public.call_queue_history;
DROP POLICY IF EXISTS "Users can insert their own call queue history" ON public.call_queue_history;
DROP POLICY IF EXISTS "Users can delete their own call queue history" ON public.call_queue_history;

CREATE POLICY "Users can view organization call queue history"
ON public.call_queue_history FOR SELECT
USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can insert organization call queue history"
ON public.call_queue_history FOR INSERT
WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization call queue history"
ON public.call_queue_history FOR DELETE
USING (organization_id = public.get_user_organization(auth.uid()));

-- Atualizar função de criar estágios padrão para usar organization_id
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id UUID;
BEGIN
  -- Obter organização do usuário
  SELECT organization_id INTO user_org_id
  FROM public.organization_members
  WHERE user_id = NEW.id
  LIMIT 1;
  
  -- Criar estágios padrão do funil
  INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (NEW.id, user_org_id, 'Novo Lead', '#10b981', 0),
    (NEW.id, user_org_id, 'Contato Feito', '#3b82f6', 1),
    (NEW.id, user_org_id, 'Proposta Enviada', '#8b5cf6', 2),
    (NEW.id, user_org_id, 'Em Negociação', '#f59e0b', 3),
    (NEW.id, user_org_id, 'Ganho', '#22c55e', 4),
    (NEW.id, user_org_id, 'Perdido', '#ef4444', 5);
  
  RETURN NEW;
END;
$$;

-- Criar trigger para criar estágios padrão
DROP TRIGGER IF EXISTS create_pipeline_stages_on_signup ON auth.users;
CREATE TRIGGER create_pipeline_stages_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_pipeline_stages();