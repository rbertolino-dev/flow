-- ============================================
-- Lote 5 de Migrations
-- Migrations 81 até 100
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


-- Migration: 20251107170850_3422f94d-de43-4777-b396-59ac033773cc.sql
-- Update RLS policy for call_queue_history to allow inserts with organization_id
DROP POLICY IF EXISTS "Users can insert organization call queue history" ON public.call_queue_history;

CREATE POLICY "Users can insert organization call queue history" 
ON public.call_queue_history 
FOR INSERT 
WITH CHECK (
  (organization_id = get_user_organization(auth.uid())) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- Migration: 20251107175817_8a5b2e46-b75b-4e06-9c5e-7d1152598d0a.sql
-- Make default pipeline stages creation idempotent to prevent unique constraint violations during user creation
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id UUID;
BEGIN
  -- Obter organização do usuário
  SELECT organization_id INTO user_org_id
  FROM public.organization_members
  WHERE user_id = NEW.id
  LIMIT 1;

  -- Criar estágios padrão do funil (idempotente)
  INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (NEW.id, user_org_id, 'Novo Lead', '#10b981', 0),
    (NEW.id, user_org_id, 'Contato Feito', '#3b82f6', 1),
    (NEW.id, user_org_id, 'Proposta Enviada', '#8b5cf6', 2),
    (NEW.id, user_org_id, 'Em Negociação', '#f59e0b', 3),
    (NEW.id, user_org_id, 'Ganho', '#22c55e', 4),
    (NEW.id, user_org_id, 'Perdido', '#ef4444', 5)
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Migration: 20251107180421_5427cf2d-d862-46bf-83a1-c7da00391ca7.sql
-- Modificar handle_new_user para NÃO criar organização automaticamente quando usuário é criado por admin
-- A edge function create-user já adiciona o usuário à organização correta
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover a função antiga que cria organização automaticamente
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Nova função que NÃO cria organização (pois isso será feito pela edge function quando necessário)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Apenas inserir perfil se não existir
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Inserir role padrão de usuário se não existir
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Migration: 20251108020734_6ed0fa1c-fcb2-4232-899f-b25eef3996cc.sql
-- Garantir que usuários possam ver perfis de outros usuários da mesma organização
-- Isso é necessário para o AddExistingUserDialog funcionar

-- Primeiro, vamos garantir que a política de visualização de perfis permita ver todos os perfis
-- (isso é seguro porque perfis contêm apenas informações básicas como email e nome)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Comentário: Esta política permite que usuários autenticados vejam todos os perfis
-- Isso é necessário para funcionalidades como adicionar usuários existentes a organizações
-- Os perfis contêm apenas informações básicas (email, nome) que são necessárias para colaboração

-- Migration: 20251108121016_880882e2-fb90-4702-8f5c-4a3d2aa2062a.sql
-- ============================================
-- CORREÇÃO DO SISTEMA MULTI-EMPRESA E PERMISSÕES
-- ============================================

-- 1. Adicionar organization_id na tabela activities
ALTER TABLE public.activities 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Popular organization_id das activities baseado nos leads
UPDATE public.activities a
SET organization_id = l.organization_id
FROM public.leads l
WHERE a.lead_id = l.id AND a.organization_id IS NULL;

-- 2. Adicionar organization_id na tabela user_permissions (permissões por organização)
ALTER TABLE public.user_permissions 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Criar índices para performance
DROP INDEX IF EXISTS idx_activities_organization_id CASCADE;
CREATE INDEX idx_activities_organization_id ON
CREATE INDEX idx_activities_organization_id ON public.activities(organization_id);
DROP INDEX IF EXISTS idx_user_permissions_organization_id CASCADE;
CREATE INDEX idx_user_permissions_organization_id ON
CREATE INDEX idx_user_permissions_organization_id ON public.user_permissions(organization_id);
DROP INDEX IF EXISTS idx_user_permissions_user_org CASCADE;
CREATE INDEX idx_user_permissions_user_org ON
CREATE INDEX idx_user_permissions_user_org ON public.user_permissions(user_id, organization_id);

-- 3. Atualizar constraint de unicidade em user_permissions (user + permission + org)
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_user_id_permission_key;
ALTER TABLE public.user_permissions 
ADD CONSTRAINT user_permissions_user_permission_org_unique 
UNIQUE (user_id, permission, organization_id);

-- 4. Função para verificar permissões por organização
CREATE OR REPLACE FUNCTION public.has_org_permission(
  _user_id UUID, 
  _permission app_permission,
  _org_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
      AND (organization_id = _org_id OR organization_id IS NULL) -- NULL = permissão global
  )
$$;

-- 5. Atualizar função get_user_permissions para incluir contexto de organização
CREATE OR REPLACE FUNCTION public.get_user_permissions_for_org(_user_id UUID, _org_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission
  FROM public.user_permissions
  WHERE user_id = _user_id
    AND (organization_id = _org_id OR organization_id IS NULL)
$$;

-- 6. Atualizar RLS policies de activities para isolamento por organização
DROP POLICY IF EXISTS "Users can insert activities for their leads" ON public.activities;
DROP POLICY IF EXISTS "Users can view activities of their leads" ON public.activities;

CREATE POLICY "Users can insert organization activities"
ON public.activities
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
);

CREATE POLICY "Users can view organization activities"
ON public.activities
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update organization activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- 7. Atualizar RLS policies de user_permissions para permitir gestão por org admins
DROP POLICY IF EXISTS "Admins can manage all user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view all user permissions" ON public.user_permissions;

-- Super admins podem ver e gerenciar tudo
CREATE POLICY "Super admins can view all permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Super admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);

-- Org admins podem gerenciar permissões da sua organização
CREATE POLICY "Org admins can view organization permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (
  user_is_org_admin(auth.uid(), organization_id)
);

CREATE POLICY "Org admins can manage organization permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
  user_is_org_admin(auth.uid(), organization_id)
)
WITH CHECK (
  user_is_org_admin(auth.uid(), organization_id)
);

-- 8. Função helper para verificar se usuário pode gerenciar outro usuário
CREATE OR REPLACE FUNCTION public.can_manage_user(
  _manager_id UUID,
  _target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Super admins podem gerenciar qualquer um
  SELECT (
    has_role(_manager_id, 'admin'::app_role) 
    OR is_pubdigital_user(_manager_id)
    -- OU org admin gerenciando usuário da mesma org
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = _manager_id
        AND om2.user_id = _target_user_id
        AND om1.role IN ('owner', 'admin')
    )
  )
$$;

-- 9. Trigger para auto-popular organization_id em activities
CREATE OR REPLACE FUNCTION public.set_activity_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se organization_id não foi fornecido, pegar do lead
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_activity_organization_trigger
BEFORE INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.set_activity_organization();

-- 10. Comentários para documentação
COMMENT ON COLUMN public.user_permissions.organization_id IS 
'ID da organização. NULL = permissão global (super admin)';

COMMENT ON FUNCTION public.has_org_permission IS 
'Verifica se usuário tem permissão específica em uma organização';

COMMENT ON FUNCTION public.can_manage_user IS 
'Verifica se um usuário (manager) pode gerenciar outro usuário (target)';

-- Migration: 20251108124746_00feac23-cab9-45f3-a3a8-93588e57478f.sql
-- Corrigir políticas RLS da tabela scheduled_messages

-- Remover todas as políticas antigas
DROP POLICY IF EXISTS "Users can view their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete their own scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Super admins can view all scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can update organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can delete organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can view organization scheduled messages" ON public.scheduled_messages;

-- Tornar organization_id NOT NULL
ALTER TABLE public.scheduled_messages 
ALTER COLUMN organization_id SET NOT NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_organization_id 
ON public.scheduled_messages(organization_id);

-- Criar índice para consulta por lead
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id 
ON public.scheduled_messages(lead_id);

-- Política SELECT para usuários da organização
CREATE POLICY "Users can view scheduled messages from their organization"
ON public.scheduled_messages
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
);

-- Política SELECT para super admins
CREATE POLICY "Super admins can view all scheduled_messages"
ON public.scheduled_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Política INSERT
CREATE POLICY "Users can create scheduled messages in their organization"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND user_id = auth.uid()
);

-- Política UPDATE
CREATE POLICY "Users can update scheduled messages in their organization"
ON public.scheduled_messages
FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()))
WITH CHECK (organization_id = get_user_organization(auth.uid()));

-- Política DELETE
CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages
FOR DELETE
USING (
  user_id = auth.uid()
  AND organization_id = get_user_organization(auth.uid())
);

COMMENT ON COLUMN public.scheduled_messages.organization_id IS 'ID da organização à qual a mensagem agendada pertence';

-- Migration: 20251108124835_04889af2-d47d-483d-9ce9-a1860283fd81.sql
-- Finalizar configuração de scheduled_messages

-- Tornar organization_id NOT NULL (se ainda não for)
DO $$ 
BEGIN
  ALTER TABLE public.scheduled_messages 
  ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_organization_id 
ON public.scheduled_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id 
ON public.scheduled_messages(lead_id);

COMMENT ON COLUMN public.scheduled_messages.organization_id IS 'ID da organização à qual a mensagem agendada pertence';

-- Migration: 20251108125748_5f69a611-b605-4480-9775-39eca7229c68.sql
-- Ajustar RLS de agendamento usando a organização do lead e criar trigger de preenchimento automático

-- 1) Função para setar organization_id a partir do lead e user_id a partir do auth
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preencher organization_id a partir do lead se vier nulo
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;

  -- Garantir user_id = usuário autenticado quando possível
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_set_scheduled_message_organization ON public.scheduled_messages;
CREATE TRIGGER trg_set_scheduled_message_organization
BEFORE INSERT ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_scheduled_message_organization();

-- 3) Atualizar política de INSERT para validar pela organização do lead
DROP POLICY IF EXISTS "Users can create organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create scheduled messages in their organization" ON public.scheduled_messages;

CREATE POLICY "Users can create scheduled messages for leads in their org"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_id
      AND l.organization_id = get_user_organization(auth.uid())
  )
);

-- 4) Manter políticas de SELECT/UPDATE/DELETE por organização
-- (não alteramos as existentes que já restringem por organization_id)

-- Migration: 20251108130721_a14dc5f5-06ea-4009-8e78-0f351bf1f45f.sql
-- Tornar a política de INSERT compatível com usuários que pertencem a múltiplas organizações
DROP POLICY IF EXISTS "Users can create scheduled messages for leads in their org" ON public.scheduled_messages;

CREATE POLICY "Users can create scheduled messages for leads where user is a member"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    JOIN public.organization_members om ON om.organization_id = l.organization_id
    WHERE l.id = lead_id
      AND om.user_id = auth.uid()
  )
);

-- Migration: 20251108132715_04181179-8f5c-4e84-a1fa-55c4ced10bd2.sql
-- Ensure function exists (idempotent)
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fill organization_id from lead if null
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;

  -- Ensure user_id defaults to current user when possible
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to set organization_id/user_id on insert
DROP TRIGGER IF EXISTS trg_set_scheduled_message_organization ON public.scheduled_messages;
CREATE TRIGGER trg_set_scheduled_message_organization
BEFORE INSERT ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_scheduled_message_organization();

-- Migration: 20251108133204_fe8adbd1-7bd4-4b48-97aa-304518a2385d.sql
-- Harden trigger: ensure organization_id is derived and not null
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- Fetch organization of the target lead
  SELECT l.organization_id INTO v_org
  FROM public.leads l
  WHERE l.id = NEW.lead_id
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead % não possui organização ou não existe', NEW.lead_id;
  END IF;

  -- Set org from lead when missing
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_org;
  END IF;

  -- Ensure user_id when missing
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- Use SECURITY DEFINER function for membership check to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.can_schedule_message_for_lead(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = _lead_id
        AND om.user_id = _user_id
    )
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.is_pubdigital_user(_user_id)
  );
$$;

-- Replace INSERT policy to rely on the function
DROP POLICY IF EXISTS "Users can create scheduled messages for leads where user is a member" ON public.scheduled_messages;
CREATE POLICY "Users can create scheduled messages (membership or admin)"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (public.can_schedule_message_for_lead(lead_id, auth.uid()));

-- Migration: 20251108133252_ad0f1af8-0f76-4037-8fb1-a58be5c114a9.sql
-- Drop existing policy if present
DROP POLICY IF EXISTS "Users can create scheduled messages for leads where user is a member" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create scheduled messages (membership or admin)" ON public.scheduled_messages;

-- Use SECURITY DEFINER function for membership check to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.can_schedule_message_for_lead(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.organization_members om ON om.organization_id = l.organization_id
      WHERE l.id = _lead_id
        AND om.user_id = _user_id
    )
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.is_pubdigital_user(_user_id)
  );
$$;

-- Create INSERT policy using the SECURITY DEFINER function
CREATE POLICY "Users can create scheduled messages (membership or admin)"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (public.can_schedule_message_for_lead(lead_id, auth.uid()));

-- Migration: 20251108133719_ef357930-1d20-4cde-a1b1-9cc1de53e149.sql
-- Garantir que todo novo lead receba organization_id automaticamente
CREATE OR REPLACE FUNCTION public.set_lead_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  -- Se já vier preenchido, não altera
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Escolher o usuário base para descobrir a organização
  v_user := COALESCE(NEW.created_by, NEW.user_id, auth.uid());

  SELECT om.organization_id INTO v_org
  FROM public.organization_members om
  WHERE om.user_id = v_user
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário % não possui organização para atribuir ao lead', v_user;
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_lead_organization ON public.leads;
CREATE TRIGGER trg_set_lead_organization
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.set_lead_organization();

-- Migration: 20251108135443_25647bd9-7f9f-4882-9e58-a51f7b7a9457.sql
-- Criar função para garantir etapas padrão para uma organização
CREATE OR REPLACE FUNCTION public.ensure_org_has_pipeline_stages(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_user_id UUID;
BEGIN
  -- Verificar se a organização já tem etapas
  IF EXISTS (SELECT 1 FROM pipeline_stages WHERE organization_id = _org_id) THEN
    RETURN;
  END IF;

  -- Pegar o primeiro usuário da organização para associar as etapas
  SELECT user_id INTO _first_user_id
  FROM organization_members
  WHERE organization_id = _org_id
  LIMIT 1;

  -- Se não houver usuários, não criar etapas
  IF _first_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Criar etapas padrão
  INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (_first_user_id, _org_id, 'Novo Lead', '#10b981', 0),
    (_first_user_id, _org_id, 'Contato Feito', '#3b82f6', 1),
    (_first_user_id, _org_id, 'Proposta Enviada', '#8b5cf6', 2),
    (_first_user_id, _org_id, 'Em Negociação', '#f59e0b', 3),
    (_first_user_id, _org_id, 'Ganho', '#22c55e', 4),
    (_first_user_id, _org_id, 'Perdido', '#ef4444', 5)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Criar trigger para garantir etapas quando organização é criada
CREATE OR REPLACE FUNCTION public.create_pipeline_stages_for_new_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Esperar um pouco para garantir que o membro foi adicionado
  -- (este trigger roda após INSERT em organizations)
  PERFORM public.ensure_org_has_pipeline_stages(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pipeline_stages_for_org ON public.organizations;
CREATE TRIGGER trg_create_pipeline_stages_for_org
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.create_pipeline_stages_for_new_org();

-- Criar trigger quando primeiro membro é adicionado a uma organização
CREATE OR REPLACE FUNCTION public.create_pipeline_stages_on_first_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir que a organização tenha etapas
  PERFORM public.ensure_org_has_pipeline_stages(NEW.organization_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_pipeline_stages_on_member ON public.organization_members;
CREATE TRIGGER trg_create_pipeline_stages_on_member
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.create_pipeline_stages_on_first_member();

-- Corrigir organizações existentes sem etapas
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN 
    SELECT DISTINCT o.id
    FROM organizations o
    LEFT JOIN pipeline_stages ps ON ps.organization_id = o.id
    WHERE ps.id IS NULL
  LOOP
    PERFORM public.ensure_org_has_pipeline_stages(org_record.id);
  END LOOP;
END $$;

-- Migration: 20251108135527_fa929b66-ee42-4b79-a92e-fc6d5b6f2da1.sql
-- Corrigir pipeline_stages sem organization_id
UPDATE pipeline_stages ps
SET organization_id = om.organization_id
FROM organization_members om
WHERE ps.organization_id IS NULL
  AND ps.user_id = om.user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = ps.user_id
    LIMIT 1
  );

-- Deletar pipeline_stages órfãos (sem organização e sem usuário válido)
DELETE FROM pipeline_stages
WHERE organization_id IS NULL;

-- Corrigir message_templates sem organization_id
UPDATE message_templates mt
SET organization_id = om.organization_id
FROM organization_members om
WHERE mt.organization_id IS NULL
  AND mt.user_id = om.user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = mt.user_id
    LIMIT 1
  );

-- Deletar message_templates órfãos
DELETE FROM message_templates
WHERE organization_id IS NULL;

-- Garantir que organization_id não seja NULL nas tabelas principais
-- (vamos tornar a coluna NOT NULL após limpeza)
ALTER TABLE pipeline_stages 
  ALTER COLUMN organization_id SET NOT NULL;

-- Verificação final
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Verificar se ainda existem registros órfãos
  SELECT COUNT(*) INTO orphan_count
  FROM (
    SELECT id FROM pipeline_stages WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM message_templates WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM leads WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM evolution_config WHERE organization_id IS NULL
  ) AS orphans;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Ainda existem % registros sem organization_id', orphan_count;
  ELSE
    RAISE NOTICE 'Todos os registros têm organization_id definido ✓';
  END IF;
END $$;

-- Migration: 20251108140131_3d3f07f5-d4a0-44c1-aeb7-721ccd02bd87.sql
-- Adicionar constraint UNIQUE para evitar duplicatas de nome por organização
ALTER TABLE public.pipeline_stages
DROP CONSTRAINT IF EXISTS pipeline_stages_org_name_unique;

ALTER TABLE public.pipeline_stages
ADD CONSTRAINT pipeline_stages_org_name_unique 
UNIQUE (organization_id, name);

-- Corrigir função para evitar criar etapas duplicadas
CREATE OR REPLACE FUNCTION public.ensure_org_has_pipeline_stages(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_user_id UUID;
  _stage_names TEXT[] := ARRAY['Novo Lead', 'Contato Feito', 'Proposta Enviada', 'Em Negociação', 'Ganho', 'Perdido'];
  _stage_colors TEXT[] := ARRAY['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];
  _stage_name TEXT;
  _stage_color TEXT;
  _position INT;
BEGIN
  -- Pegar o primeiro usuário da organização para associar as etapas
  SELECT user_id INTO _first_user_id
  FROM organization_members
  WHERE organization_id = _org_id
  LIMIT 1;

  -- Se não houver usuários, não criar etapas
  IF _first_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Criar cada etapa apenas se não existir com o mesmo nome
  FOR _position IN 0..5 LOOP
    _stage_name := _stage_names[_position + 1];
    _stage_color := _stage_colors[_position + 1];
    
    -- Inserir apenas se não existir etapa com este nome nesta organização
    INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
    VALUES (_first_user_id, _org_id, _stage_name, _stage_color, _position)
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END;
$$;

-- Migration: 20251108140201_14421b14-82cf-4d57-91d6-a9b9a310ecc3.sql
-- Adicionar constraint UNIQUE para evitar duplicatas de nome por organização
ALTER TABLE public.pipeline_stages
DROP CONSTRAINT IF EXISTS pipeline_stages_org_name_unique;

ALTER TABLE public.pipeline_stages
ADD CONSTRAINT pipeline_stages_org_name_unique 
UNIQUE (organization_id, name);

-- Corrigir função para evitar criar etapas duplicadas
CREATE OR REPLACE FUNCTION public.ensure_org_has_pipeline_stages(_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_user_id UUID;
  _stage_names TEXT[] := ARRAY['Novo Lead', 'Contato Feito', 'Proposta Enviada', 'Em Negociação', 'Ganho', 'Perdido'];
  _stage_colors TEXT[] := ARRAY['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];
  _stage_name TEXT;
  _stage_color TEXT;
  _position INT;
BEGIN
  -- Pegar o primeiro usuário da organização para associar as etapas
  SELECT user_id INTO _first_user_id
  FROM organization_members
  WHERE organization_id = _org_id
  LIMIT 1;

  -- Se não houver usuários, não criar etapas
  IF _first_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Criar cada etapa apenas se não existir com o mesmo nome
  FOR _position IN 0..5 LOOP
    _stage_name := _stage_names[_position + 1];
    _stage_color := _stage_colors[_position + 1];
    
    -- Inserir apenas se não existir etapa com este nome nesta organização
    INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
    VALUES (_first_user_id, _org_id, _stage_name, _stage_color, _position)
    ON CONFLICT (organization_id, name) DO NOTHING;
  END LOOP;
END;
$$;

-- Migration: 20251108140933_d404d66f-8641-48a0-981b-adad3dc3fa11.sql
-- Tornar organization_id NOT NULL em todas as tabelas principais

ALTER TABLE tags 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE message_templates 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE evolution_config 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE leads 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE call_queue 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE activities 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE scheduled_messages 
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE broadcast_campaigns 
  ALTER COLUMN organization_id SET NOT NULL;

-- Criar função genérica para garantir organization_id
CREATE OR REPLACE FUNCTION public.ensure_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  -- Se já tem organization_id, não fazer nada
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar pegar do user_id ou created_by
  v_user := COALESCE(NEW.user_id, NEW.created_by, auth.uid());
  
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar o usuário para atribuir organização';
  END IF;

  -- Buscar organização do usuário
  SELECT om.organization_id INTO v_org
  FROM public.organization_members om
  WHERE om.user_id = v_user
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Usuário % não pertence a nenhuma organização', v_user;
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

-- Aplicar trigger em tags
DROP TRIGGER IF EXISTS trg_ensure_org_tags ON public.tags;
CREATE TRIGGER trg_ensure_org_tags
BEFORE INSERT ON public.tags
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em message_templates
DROP TRIGGER IF EXISTS trg_ensure_org_templates ON public.message_templates;
CREATE TRIGGER trg_ensure_org_templates
BEFORE INSERT ON public.message_templates
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em evolution_config
DROP TRIGGER IF EXISTS trg_ensure_org_evolution ON public.evolution_config;
CREATE TRIGGER trg_ensure_org_evolution
BEFORE INSERT ON public.evolution_config
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em call_queue
DROP TRIGGER IF EXISTS trg_ensure_org_call_queue ON public.call_queue;
CREATE TRIGGER trg_ensure_org_call_queue
BEFORE INSERT ON public.call_queue
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em activities
DROP TRIGGER IF EXISTS trg_ensure_org_activities ON public.activities;
CREATE TRIGGER trg_ensure_org_activities
BEFORE INSERT ON public.activities
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Aplicar trigger em broadcast_campaigns
DROP TRIGGER IF EXISTS trg_ensure_org_campaigns ON public.broadcast_campaigns;
CREATE TRIGGER trg_ensure_org_campaigns
BEFORE INSERT ON public.broadcast_campaigns
FOR EACH ROW
WHEN (NEW.organization_id IS NULL)
EXECUTE FUNCTION public.ensure_organization_id();

-- Migration: 20251108142918_11fc14b6-6a4d-4323-bb90-ea04abc246f4.sql
-- Fix recursive SELECT policy on organization_members causing infinite recursion
-- 1) Drop the self-referential policy
DROP POLICY IF EXISTS "Users can view members of their organization" ON public.organization_members;

-- 2) Recreate using SECURITY DEFINER helper (avoids recursion)
CREATE POLICY "Users can view members of their organization"
ON public.organization_members
FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

-- Keep existing admin-wide visibility policy as-is
-- No change to INSERT/UPDATE/DELETE policies (they already use definer functions)


-- Migration: 20251108143458_a2a00f59-b9ee-4c13-81e7-470403c89b69.sql
-- Função para transferir ownership de todos os dados de um usuário para o admin da org
CREATE OR REPLACE FUNCTION public.transfer_user_data_to_admin(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id UUID;
BEGIN
  -- Buscar o primeiro admin/owner da organização
  SELECT user_id INTO _admin_id
  FROM public.organization_members
  WHERE organization_id = _org_id
    AND role IN ('owner', 'admin')
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
    END
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum administrador encontrado na organização';
  END IF;

  -- Transferir leads
  UPDATE public.leads
  SET user_id = _admin_id, 
      updated_by = _admin_id,
      updated_at = now()
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir activities
  UPDATE public.activities
  SET user_name = (SELECT full_name FROM profiles WHERE id = _admin_id)
  WHERE lead_id IN (
    SELECT id FROM leads WHERE organization_id = _org_id
  );

  -- Transferir call_queue
  UPDATE public.call_queue
  SET created_by = _admin_id,
      updated_by = _admin_id
  WHERE created_by = _user_id
    AND organization_id = _org_id;

  -- Transferir scheduled_messages
  UPDATE public.scheduled_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir message_templates
  UPDATE public.message_templates
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir broadcast_campaigns
  UPDATE public.broadcast_campaigns
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir tags
  UPDATE public.tags
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir pipeline_stages
  UPDATE public.pipeline_stages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir evolution_config
  UPDATE public.evolution_config
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_lid_contacts
  UPDATE public.whatsapp_lid_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir international_contacts
  UPDATE public.international_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_messages
  UPDATE public.whatsapp_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;
END;
$$;

-- Função para excluir usuário de uma organização
CREATE OR REPLACE FUNCTION public.delete_user_from_organization(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Primeiro transferir todos os dados
  PERFORM public.transfer_user_data_to_admin(_user_id, _org_id);

  -- Remover o usuário da organização
  DELETE FROM public.organization_members
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Se o usuário não pertence a nenhuma organização, deletar profile e auth
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE user_id = _user_id
  ) THEN
    -- Deletar profile (auth será deletado em cascata se configurado)
    DELETE FROM public.profiles WHERE id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  END IF;
END;
$$;

COMMIT;
