-- Migration: Sistema de Agendamento Público
-- Permite que usuários finais agendem reuniões via link público
-- Requer aprovação do cliente antes de criar no Google Calendar

-- Tabela de configuração de agendamento por organização
CREATE TABLE IF NOT EXISTS public.organization_booking_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE, -- Slug único para link público (ex: /book/empresa-abc)
  is_active boolean NOT NULL DEFAULT true,
  default_duration_minutes integer NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  require_approval boolean NOT NULL DEFAULT true, -- Sempre requer aprovação
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id) -- Uma organização tem apenas uma configuração
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_organization_booking_configs_org
  ON public.organization_booking_configs (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_booking_configs_slug
  ON public.organization_booking_configs (public_slug);

-- Tabela de horários disponíveis por usuário
CREATE TABLE IF NOT EXISTS public.user_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = domingo, 6 = sábado
  start_time time NOT NULL, -- Horário de início (ex: 09:00:00)
  end_time time NOT NULL, -- Horário de fim (ex: 18:00:00)
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, day_of_week, start_time, end_time)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_availability_slots_org
  ON public.user_availability_slots (organization_id);

CREATE INDEX IF NOT EXISTS idx_user_availability_slots_user
  ON public.user_availability_slots (user_id);

CREATE INDEX IF NOT EXISTS idx_user_availability_slots_day
  ON public.user_availability_slots (day_of_week, is_active);

-- Tabela de solicitações de agendamento (fila de aprovação)
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id), -- Usuário da organização que será responsável
  google_calendar_config_id uuid REFERENCES public.google_calendar_configs(id),
  requested_datetime timestamptz NOT NULL, -- Data/hora solicitada pelo cliente final
  duration_minutes integer NOT NULL DEFAULT 60,
  client_name text NOT NULL, -- Nome do cliente final
  client_email text,
  client_phone text NOT NULL, -- Telefone para WhatsApp
  client_notes text, -- Observações do cliente
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  google_event_id text, -- ID do evento criado no Google Calendar após aprovação
  calendar_event_id uuid REFERENCES public.calendar_events(id),
  confirmation_sent_at timestamptz, -- Quando foi enviada confirmação WhatsApp
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_booking_requests_org
  ON public.booking_requests (organization_id);

CREATE INDEX IF NOT EXISTS idx_booking_requests_user
  ON public.booking_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status
  ON public.booking_requests (status, created_at);

CREATE INDEX IF NOT EXISTS idx_booking_requests_datetime
  ON public.booking_requests (requested_datetime);

-- Tabela de templates de mensagem WhatsApp por organização
CREATE TABLE IF NOT EXISTS public.booking_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_type text NOT NULL CHECK (template_type IN ('approval', 'confirmation', 'reminder')),
  template_text text NOT NULL, -- Template com variáveis: {nome}, {data}, {hora}, {link_meet}, etc.
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, template_type) -- Um template de cada tipo por organização
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_booking_templates_org
  ON public.booking_templates (organization_id);

CREATE INDEX IF NOT EXISTS idx_booking_templates_type
  ON public.booking_templates (template_type, is_active);

-- Habilitar RLS
ALTER TABLE public.organization_booking_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_templates ENABLE ROW LEVEL SECURITY;

-- Policies para organization_booking_configs
DROP POLICY IF EXISTS "Organization booking config: members can select" ON public.organization_booking_configs;
CREATE POLICY "Organization booking config: members can select"
  ON public.organization_booking_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_booking_configs.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), organization_booking_configs.organization_id)
  );

-- Política pública para buscar por slug (sem autenticação)
DROP POLICY IF EXISTS "Organization booking config: public can select by slug" ON public.organization_booking_configs;
CREATE POLICY "Organization booking config: public can select by slug"
  ON public.organization_booking_configs
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Organization booking config: admins can manage" ON public.organization_booking_configs;
CREATE POLICY "Organization booking config: admins can manage"
  ON public.organization_booking_configs
  FOR ALL
  USING (
    public.user_is_org_admin(auth.uid(), organization_booking_configs.organization_id)
  );

-- Policies para user_availability_slots
DROP POLICY IF EXISTS "User availability: users can manage own slots" ON public.user_availability_slots;
CREATE POLICY "User availability: users can manage own slots"
  ON public.user_availability_slots
  FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = user_availability_slots.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), user_availability_slots.organization_id)
  );

-- Policies para booking_requests
DROP POLICY IF EXISTS "Booking requests: members can select" ON public.booking_requests;
CREATE POLICY "Booking requests: members can select"
  ON public.booking_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = booking_requests.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), booking_requests.organization_id)
  );

-- Política pública para criar solicitação (sem autenticação)
DROP POLICY IF EXISTS "Booking requests: public can insert" ON public.booking_requests;
CREATE POLICY "Booking requests: public can insert"
  ON public.booking_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_booking_configs obc
      WHERE obc.organization_id = booking_requests.organization_id
        AND obc.is_active = true
    )
  );

DROP POLICY IF EXISTS "Booking requests: members can update" ON public.booking_requests;
CREATE POLICY "Booking requests: members can update"
  ON public.booking_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = booking_requests.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), booking_requests.organization_id)
  );

-- Policies para booking_templates
DROP POLICY IF EXISTS "Booking templates: members can select" ON public.booking_templates;
CREATE POLICY "Booking templates: members can select"
  ON public.booking_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = booking_templates.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), booking_templates.organization_id)
  );

DROP POLICY IF EXISTS "Booking templates: admins can manage" ON public.booking_templates;
CREATE POLICY "Booking templates: admins can manage"
  ON public.booking_templates
  FOR ALL
  USING (
    public.user_is_org_admin(auth.uid(), booking_templates.organization_id)
  );

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_organization_booking_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organization_booking_configs_updated_at ON public.organization_booking_configs;
CREATE TRIGGER trigger_organization_booking_configs_updated_at
  BEFORE UPDATE ON public.organization_booking_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_booking_configs_updated_at();

CREATE OR REPLACE FUNCTION public.update_user_availability_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_availability_slots_updated_at ON public.user_availability_slots;
CREATE TRIGGER trigger_user_availability_slots_updated_at
  BEFORE UPDATE ON public.user_availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_availability_slots_updated_at();

CREATE OR REPLACE FUNCTION public.update_booking_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_requests_updated_at ON public.booking_requests;
CREATE TRIGGER trigger_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_booking_requests_updated_at();

CREATE OR REPLACE FUNCTION public.update_booking_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_templates_updated_at ON public.booking_templates;
CREATE TRIGGER trigger_booking_templates_updated_at
  BEFORE UPDATE ON public.booking_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_booking_templates_updated_at();

-- Comentários
COMMENT ON TABLE public.organization_booking_configs IS 'Configuração de agendamento público por organização';
COMMENT ON COLUMN public.organization_booking_configs.public_slug IS 'Slug único para link público (ex: /book/empresa-abc)';
COMMENT ON TABLE public.user_availability_slots IS 'Horários disponíveis por usuário da organização';
COMMENT ON COLUMN public.user_availability_slots.day_of_week IS '0 = domingo, 1 = segunda, ..., 6 = sábado';
COMMENT ON TABLE public.booking_requests IS 'Solicitações de agendamento (fila de aprovação)';
COMMENT ON COLUMN public.booking_requests.status IS 'pending, approved, rejected, cancelled';
COMMENT ON TABLE public.booking_templates IS 'Templates de mensagem WhatsApp para agendamentos';

