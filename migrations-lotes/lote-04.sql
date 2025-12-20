-- ============================================
-- Lote 4 de Migrations
-- Migrations 61 até 80
-- ============================================

-- ============================================
-- LIMPEZA COMPLETA DE OBJETOS DUPLICADOS
-- ============================================

-- Follow-up Templates - Policies
DROP POLICY IF EXISTS "Etapas de modelo de acompanhamento: os membros podem atualizar" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up template steps: members can update" ON public.follow_up_template_steps;
DROP POLICY IF EXISTS "Follow-up templates: members can select" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can insert" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can update" ON public.follow_up_templates;
DROP POLICY IF EXISTS "Follow-up templates: members can delete" ON public.follow_up_templates;

-- Google Calendar - Triggers e Functions
DROP TRIGGER IF EXISTS trigger_google_calendar_configs_updated_at ON public.google_calendar_configs CASCADE;
DROP FUNCTION IF EXISTS public.update_google_calendar_configs_updated_at() CASCADE;
DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON public.calendar_events CASCADE;
DROP FUNCTION IF EXISTS public.update_calendar_events_updated_at() CASCADE;

-- Google Calendar - Policies (todas)
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem selecionar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem inserir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem atualizar" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Configuração do Google Agenda: membros podem excluir" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can select" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can insert" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can update" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Google Calendar config: members can delete" ON public.google_calendar_configs;
DROP POLICY IF EXISTS "Calendar events: members can select" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can insert" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can update" ON public.calendar_events;
DROP POLICY IF EXISTS "Calendar events: members can delete" ON public.calendar_events;

-- Outras policies conhecidas
DROP POLICY IF EXISTS "Service role can manage metrics" ON public.instance_health_metrics_hourly;
DROP POLICY IF EXISTS "Lead follow-ups: members can select" ON public.lead_follow_ups;
DROP POLICY IF EXISTS "Lead follow-ups: members can update" ON public.lead_follow_ups;

BEGIN;


-- Migration: 20251107053120_b9812105-e657-4e42-97af-58001e89f25f.sql
-- Criar tabela para mensagens agendadas
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'document')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own scheduled messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled messages"
  ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled messages"
  ON public.scheduled_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled messages"
  ON public.scheduled_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhorar performance
CREATE INDEX idx_scheduled_messages_user_status 
  ON public.scheduled_messages(user_id, status);

CREATE INDEX idx_scheduled_messages_scheduled_for 
  ON public.scheduled_messages(scheduled_for) 
  WHERE status = 'pending';

-- Migration: 20251107054243_9ebdf764-8ce2-40b6-94e3-9f0362bc609b.sql
-- Adicionar campos de data de retorno e instância de origem na tabela leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS source_instance_id UUID REFERENCES public.evolution_config(id);

-- Criar índice para melhorar performance das buscas
CREATE INDEX IF NOT EXISTS idx_leads_return_date 
  ON public.leads(return_date) 
  WHERE return_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_instance 
  ON public.leads(source_instance_id) 
  WHERE source_instance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_created_at 
  ON public.leads(created_at);

-- Migration: 20251107060918_f49a48c8-8325-438d-834d-94c5dbee41bf.sql
-- Add DELETE policy to allow users to clear their own call queue
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'call_queue' AND policyname = 'Users can delete their call queue'
  ) THEN
    CREATE POLICY "Users can delete their call queue"
    ON public.call_queue
    FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = call_queue.lead_id AND l.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Migration: 20251107061257_dc3862ba-fbc4-475f-9971-116655ada26d.sql
-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger para criar profile automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Adicionar campos de auditoria na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

-- Adicionar campos de auditoria na tabela call_queue
ALTER TABLE public.call_queue
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

-- Trigger para atualizar updated_by em leads
CREATE OR REPLACE FUNCTION public.update_lead_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  
  -- Se for INSERT, também setar created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER lead_audit_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_audit();

-- Trigger para atualizar updated_by em call_queue
CREATE OR REPLACE FUNCTION public.update_call_queue_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  
  -- Se for INSERT, também setar created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER call_queue_audit_trigger
  BEFORE INSERT OR UPDATE ON public.call_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_audit();

-- Migration: 20251107061732_da773bbb-6292-4bf6-a01e-dd5653954961.sql
-- Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Criar tabela de roles de usuários
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas para visualizar roles
CREATE POLICY "Everyone can view user roles"
ON public.user_roles FOR SELECT
USING (true);

-- Criar função security definer para verificar se usuário tem uma role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Apenas admins podem inserir/atualizar/deletar roles
CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Atualizar trigger para criar role padrão ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- Políticas para profiles - apenas admins podem deletar usuários
CREATE POLICY "Only admins can delete profiles"
ON public.profiles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Migration: 20251107063520_a292d6c9-f9da-49f5-b9cb-4fa08d5fcd48.sql
-- Adicionar política para admins poderem editar qualquer profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Migration: 20251107064428_dee98c52-a3f4-4b31-a770-05d78d1a6ab7.sql
-- Tabela para campanhas de disparo em massa
CREATE TABLE public.broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
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

-- Tabela para fila de contatos da campanha
CREATE TABLE public.broadcast_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'scheduled', 'sent', 'failed'))
);

-- Habilitar RLS
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para campanhas
CREATE POLICY "Users can view their own campaigns"
ON public.broadcast_campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.broadcast_campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.broadcast_campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.broadcast_campaigns FOR DELETE
USING (auth.uid() = user_id);

-- Políticas RLS para fila
CREATE POLICY "Users can view queue of their campaigns"
ON public.broadcast_queue FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can insert queue for their campaigns"
ON public.broadcast_queue FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update queue of their campaigns"
ON public.broadcast_queue FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete queue of their campaigns"
ON public.broadcast_queue FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

-- Índices para performance
DROP INDEX IF EXISTS idx_broadcast_queue_campaign CASCADE;
CREATE INDEX idx_broadcast_queue_campaign ON
CREATE INDEX idx_broadcast_queue_campaign ON public.broadcast_queue(campaign_id);
DROP INDEX IF EXISTS idx_broadcast_queue_status CASCADE;
CREATE INDEX idx_broadcast_queue_status ON
CREATE INDEX idx_broadcast_queue_status ON public.broadcast_queue(status);
DROP INDEX IF EXISTS idx_broadcast_queue_scheduled CASCADE;
CREATE INDEX idx_broadcast_queue_scheduled ON
CREATE INDEX idx_broadcast_queue_scheduled ON public.broadcast_queue(scheduled_for) WHERE status = 'scheduled';

-- Migration: 20251107072004_c74e5158-38d2-4b62-abb0-86a137084aef.sql
-- Criar tabela de mensagens do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, audio, image, video, document
  media_url TEXT,
  direction TEXT NOT NULL, -- incoming, outgoing
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_status BOOLEAN DEFAULT false,
  message_id TEXT, -- ID da mensagem do WhatsApp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_phone ON public.whatsapp_messages(user_id, phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_timestamp ON public.whatsapp_messages(user_id, timestamp DESC);

-- Habilitar RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.whatsapp_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.whatsapp_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Migration: 20251107124331_96fdb4b4-98a6-407f-9640-97808b588c5d.sql
-- Criar enum para as funcionalidades do sistema
CREATE TYPE public.app_permission AS ENUM (
  'view_leads',
  'create_leads',
  'edit_leads',
  'delete_leads',
  'view_call_queue',
  'manage_call_queue',
  'view_broadcast',
  'create_broadcast',
  'view_whatsapp',
  'send_whatsapp',
  'view_templates',
  'manage_templates',
  'view_pipeline',
  'manage_pipeline',
  'view_settings',
  'manage_settings',
  'manage_users',
  'view_reports'
);

-- Criar tabela de permissões dos usuários
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, permission)
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_permissions
CREATE POLICY "Admins can view all user permissions"
  ON public.user_permissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all user permissions"
  ON public.user_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Função para verificar se um usuário tem uma permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  )
$$;

-- Função para obter todas as permissões de um usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission
  FROM public.user_permissions
  WHERE user_id = _user_id
$$;

-- Migration: 20251107142430_0313e5db-8d1e-4187-84b2-9def977d9508.sql
-- Create function to check user role without requiring enum
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role
  );
$$;

-- Create auth audit logs table if it doesn't exist
create table if not exists public.auth_audit_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  error text,
  ip text,
  user_agent text,
  method text,
  user_id uuid,
  created_at timestamptz not null default now()
);

-- Enable RLS and admin-only read access
alter table public.auth_audit_logs enable row level security;

-- Drop existing select policy if any to replace with correct one
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'auth_audit_logs' and policyname = 'Admins can read auth audit logs'
  ) then
    execute 'drop policy "Admins can read auth audit logs" on public.auth_audit_logs';
  end if;
end $$;

create policy "Admins can read auth audit logs"
  on public.auth_audit_logs
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Helpful indexes
DROP INDEX IF EXISTS idx_auth_audit_logs_created_at CASCADE;
CREATE INDEX idx_auth_audit_logs_created_at ON
create index if not exists idx_auth_audit_logs_created_at on public.auth_audit_logs (created_at desc);
DROP INDEX IF EXISTS idx_auth_audit_logs_email CASCADE;
CREATE INDEX idx_auth_audit_logs_email ON
create index if not exists idx_auth_audit_logs_email on public.auth_audit_logs (email);


-- Migration: 20251107144206_72ef33ad-9da6-4e60-8f60-f5f11c5857a8.sql
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

-- Migration: 20251107151301_c9b60d1e-35c1-46e8-99d8-b0544571bff8.sql
-- Drop existing conflicting policies first
drop policy if exists "Admins or pubdigital can view all organizations" on public.organizations;
drop policy if exists "Admins or pubdigital can view all members" on public.organization_members;

-- Function to allow pubdigital users to access all orgs
create or replace function public.is_pubdigital_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = _user_id
      and lower(o.name) like '%pubdigital%'
  );
$$;

-- Allow admins or pubdigital users to view all organizations
create policy "Super admins can view all organizations"
on public.organizations
for select
using (
  public.has_role(auth.uid(), 'admin'::app_role)
  or public.is_pubdigital_user(auth.uid())
);

-- Allow admins or pubdigital users to view all organization members
create policy "Super admins can view all members"
on public.organization_members
for select
using (
  public.has_role(auth.uid(), 'admin'::app_role)
  or public.is_pubdigital_user(auth.uid())
);


-- Migration: 20251107152459_bea1331a-b85d-431a-8cb2-4fbbf1bcfd82.sql
-- Add read-only super admin access (admins or users in org containing 'pubdigital')
-- This keeps existing org-scoped policies for INSERT/UPDATE/DELETE intact

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all leads"
  ON public.leads
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue"
  ON public.call_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE HISTORY
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_history"
  ON public.call_queue_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_tags"
  ON public.call_queue_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ACTIVITIES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all activities"
  ON public.activities
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEAD TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all lead_tags"
  ON public.lead_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all tags"
  ON public.tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MESSAGE TEMPLATES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all message_templates"
  ON public.message_templates
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SCHEDULED MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all scheduled_messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INTERNATIONAL CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all international_contacts"
  ON public.international_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP LID CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_lid_contacts"
  ON public.whatsapp_lid_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST CAMPAIGNS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_campaigns"
  ON public.broadcast_campaigns
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PIPELINE STAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all pipeline_stages"
  ON public.pipeline_stages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EVOLUTION CONFIG
DO $$ BEGIN
  CREATE POLICY "Super admins can view all evolution_config"
  ON public.evolution_config
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migration: 20251107152534_d767bc2b-d245-4b5a-b101-2857973781d6.sql
-- Add read-only super admin access (admins or users in org containing 'pubdigital')
-- This keeps existing org-scoped policies for INSERT/UPDATE/DELETE intact

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all leads"
  ON public.leads
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue"
  ON public.call_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE HISTORY
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_history"
  ON public.call_queue_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_tags"
  ON public.call_queue_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ACTIVITIES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all activities"
  ON public.activities
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEAD TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all lead_tags"
  ON public.lead_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all tags"
  ON public.tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MESSAGE TEMPLATES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all message_templates"
  ON public.message_templates
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SCHEDULED MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all scheduled_messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INTERNATIONAL CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all international_contacts"
  ON public.international_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP LID CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_lid_contacts"
  ON public.whatsapp_lid_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST CAMPAIGNS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_campaigns"
  ON public.broadcast_campaigns
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PIPELINE STAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all pipeline_stages"
  ON public.pipeline_stages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EVOLUTION CONFIG
DO $$ BEGIN
  CREATE POLICY "Super admins can view all evolution_config"
  ON public.evolution_config
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migration: 20251107152556_01b783c1-efdd-41a2-bb9c-502a2dac7a1f.sql
-- Add read-only super admin access (admins or users in org containing 'pubdigital')
-- This keeps existing org-scoped policies for INSERT/UPDATE/DELETE intact

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all leads"
  ON public.leads
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue"
  ON public.call_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE HISTORY
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_history"
  ON public.call_queue_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_tags"
  ON public.call_queue_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ACTIVITIES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all activities"
  ON public.activities
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEAD TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all lead_tags"
  ON public.lead_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all tags"
  ON public.tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MESSAGE TEMPLATES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all message_templates"
  ON public.message_templates
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SCHEDULED MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all scheduled_messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INTERNATIONAL CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all international_contacts"
  ON public.international_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP LID CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_lid_contacts"
  ON public.whatsapp_lid_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST CAMPAIGNS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_campaigns"
  ON public.broadcast_campaigns
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PIPELINE STAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all pipeline_stages"
  ON public.pipeline_stages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EVOLUTION CONFIG
DO $$ BEGIN
  CREATE POLICY "Super admins can view all evolution_config"
  ON public.evolution_config
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migration: 20251107153143_f5be3727-6b83-4436-aa19-3e1cd68b932e.sql
-- Garantir que todos os usuários existentes tenham uma organização
DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  user_email TEXT;
BEGIN
  -- Para cada usuário que não tem organização
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    WHERE om.user_id IS NULL
  LOOP
    -- Extrair email
    user_email := user_record.email;
    
    -- Criar organização para o usuário
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(user_record.raw_user_meta_data->>'full_name', user_email) || ' - Empresa')
    RETURNING id INTO new_org_id;
    
    -- Adicionar usuário como owner da organização
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'owner');
    
    -- Garantir que o perfil existe
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      user_record.id,
      user_email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_email)
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Garantir que tem role de user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_record.id, 'user')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Organização criada para usuário: %', user_email;
  END LOOP;
END $$;

-- Migration: 20251107153205_423939c5-9f01-4e42-9483-cb8c7d1412c4.sql
-- Garantir que todos os usuários existentes tenham uma organização
DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  user_email TEXT;
BEGIN
  -- Para cada usuário que não tem organização
  FOR user_record IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.organization_members om ON om.user_id = au.id
    WHERE om.user_id IS NULL
  LOOP
    -- Extrair email
    user_email := user_record.email;
    
    -- Criar organização para o usuário
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(user_record.raw_user_meta_data->>'full_name', user_email) || ' - Empresa')
    RETURNING id INTO new_org_id;
    
    -- Adicionar usuário como owner da organização
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'owner');
    
    -- Garantir que o perfil existe
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      user_record.id,
      user_email,
      COALESCE(user_record.raw_user_meta_data->>'full_name', user_email)
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Garantir que tem role de user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_record.id, 'user')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Organização criada para usuário: %', user_email;
  END LOOP;
END $$;

-- Migration: 20251107155741_4fc0284e-4294-48ff-895d-970e1fef5dae.sql
-- Criar função security definer para buscar organizações com membros (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.get_all_organizations_with_members()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_created_at timestamptz,
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
    om.user_id as member_user_id,
    om.role as member_role,
    om.created_at as member_created_at,
    p.email as member_email,
    p.full_name as member_full_name,
    (
      SELECT jsonb_agg(jsonb_build_object('role', ur.role))
      FROM user_roles ur
      WHERE ur.user_id = om.user_id
    ) as member_roles
  FROM organizations o
  LEFT JOIN organization_members om ON om.organization_id = o.id
  LEFT JOIN profiles p ON p.id = om.user_id
  ORDER BY o.created_at DESC;
$$;

-- Migration: 20251107161055_516c4a29-eea7-4862-bd92-5e1f937f3fc5.sql
DROP FUNCTION IF EXISTS to check if user is owner/admin of an org CASCADE;
CREATE FUNCTION to check if user is owner/admin of an org(
-- 1) Create function to check if user is owner/admin of an org (avoids policy recursion)
CREATE OR REPLACE FUNCTION public.user_is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role IN ('owner', 'admin')
  );
$$;

-- 2) Replace recursive policy on organization_members with function-based policies
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_members;

-- Insert
CREATE POLICY "Org admins manage members - insert"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- Update
CREATE POLICY "Org admins manage members - update"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- Delete
CREATE POLICY "Org admins manage members - delete"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  public.user_is_org_admin(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_pubdigital_user(auth.uid())
);

-- 3) Function to create organization and set owner in one atomic call (avoids RLS issues)
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(org_name text, owner_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations(name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (new_org_id, COALESCE(owner_user_id, auth.uid()), 'owner');

  RETURN new_org_id;
END;
$$;

-- Migration: 20251107161502_5d4d41c1-5389-401a-a35f-83ffce45b405.sql
-- 1) Adicionar organization_id em evolution_logs para isolamento correto
ALTER TABLE public.evolution_logs 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_evolution_logs_organization 
ON public.evolution_logs(organization_id);

-- 2) Atualizar políticas RLS de evolution_logs para usar organization_id
DROP POLICY IF EXISTS "Users can insert their own evolution logs" ON public.evolution_logs;
DROP POLICY IF EXISTS "Users can view their own evolution logs" ON public.evolution_logs;

CREATE POLICY "Users can insert organization evolution logs"
ON public.evolution_logs
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view organization evolution logs"
ON public.evolution_logs
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all evolution logs"
ON public.evolution_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 3) Garantir que activities acessa apenas leads da mesma org (já correto via leads)
-- Adicionar política super admin que faltava
CREATE POLICY "Super admins can delete activities"
ON public.activities
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can update activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 4) Verificar políticas de broadcast_queue para super admins
CREATE POLICY "Super admins can update broadcast queue"
ON public.broadcast_queue
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 5) Adicionar políticas super admin faltantes em call_queue_tags
CREATE POLICY "Super admins can update call queue tags"
ON public.call_queue_tags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 6) Adicionar políticas super admin faltantes em lead_tags
CREATE POLICY "Super admins can update lead tags"
ON public.lead_tags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 7) Garantir que organizations pode ser inserida por super admins
CREATE POLICY "Super admins can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

COMMIT;
