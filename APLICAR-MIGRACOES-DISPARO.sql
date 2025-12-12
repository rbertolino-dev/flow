-- ============================================
-- MIGRAÇÕES: Disparo em Massa
-- Aplicar no Supabase Dashboard > SQL Editor
-- Execute este script completo
-- ============================================

-- ============================================
-- MIGRAÇÃO 1: Tabela de Janelas de Horário
-- ============================================

-- Tabela para janelas de horário de envio por organização
CREATE TABLE IF NOT EXISTS public.broadcast_time_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Horários de segunda a sexta
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
  -- Horários de sábado
  saturday_start TIME,
  saturday_end TIME,
  -- Horários de domingo
  sunday_start TIME,
  sunday_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled) WHERE enabled = true;

-- Habilitar RLS
ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Organizations can view their time windows" ON public.broadcast_time_windows;
DROP POLICY IF EXISTS "Organizations can create time windows" ON public.broadcast_time_windows;
DROP POLICY IF EXISTS "Organizations can update their time windows" ON public.broadcast_time_windows;
DROP POLICY IF EXISTS "Organizations can delete their time windows" ON public.broadcast_time_windows;

-- Policies RLS
CREATE POLICY "Organizations can view their time windows"
ON public.broadcast_time_windows FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can create time windows"
ON public.broadcast_time_windows FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can update their time windows"
ON public.broadcast_time_windows FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Organizations can delete their time windows"
ON public.broadcast_time_windows FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Função para verificar se um horário está dentro da janela
CREATE OR REPLACE FUNCTION public.is_time_in_window(
  _window_id UUID,
  _check_timestamp TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _day_of_week INT := EXTRACT(DOW FROM _check_timestamp); -- 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  _check_time TIME := _check_timestamp::TIME;
  _start_time TIME;
  _end_time TIME;
BEGIN
  SELECT
    CASE _day_of_week
      WHEN 1 THEN monday_start
      WHEN 2 THEN tuesday_start
      WHEN 3 THEN wednesday_start
      WHEN 4 THEN thursday_start
      WHEN 5 THEN friday_start
      WHEN 6 THEN saturday_start
      WHEN 0 THEN sunday_start
      ELSE NULL
    END,
    CASE _day_of_week
      WHEN 1 THEN monday_end
      WHEN 2 THEN tuesday_end
      WHEN 3 THEN wednesday_end
      WHEN 4 THEN thursday_end
      WHEN 5 THEN friday_end
      WHEN 6 THEN saturday_end
      WHEN 0 THEN sunday_end
      ELSE NULL
    END
  INTO _start_time, _end_time
  FROM public.broadcast_time_windows
  WHERE id = _window_id AND enabled = TRUE;

  IF _start_time IS NOT NULL AND _end_time IS NOT NULL THEN
    RETURN _check_time >= _start_time AND _check_time <= _end_time;
  END IF;

  RETURN FALSE;
END;
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_broadcast_time_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS update_broadcast_time_windows_updated_at ON public.broadcast_time_windows;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_broadcast_time_windows_updated_at
BEFORE UPDATE ON public.broadcast_time_windows
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_time_windows_updated_at();

-- ============================================
-- MIGRAÇÃO 2: Tabela de Grupos de Instâncias
-- ============================================

-- Tabela para grupos de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.instance_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instance_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instance_groups_org ON public.instance_groups(organization_id);

-- Habilitar RLS
ALTER TABLE public.instance_groups ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "Users can view instance groups of their organization" ON public.instance_groups;
DROP POLICY IF EXISTS "Users can create instance groups for their organization" ON public.instance_groups;
DROP POLICY IF EXISTS "Users can update instance groups of their organization" ON public.instance_groups;
DROP POLICY IF EXISTS "Users can delete instance groups of their organization" ON public.instance_groups;

-- Policies RLS
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

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instance_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS update_instance_groups_updated_at ON public.instance_groups;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_groups_updated_at
BEFORE UPDATE ON public.instance_groups
FOR EACH ROW
EXECUTE FUNCTION update_instance_groups_updated_at();

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se as tabelas foram criadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'broadcast_time_windows'
  ) THEN
    RAISE EXCEPTION 'Tabela broadcast_time_windows não foi criada!';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'instance_groups'
  ) THEN
    RAISE EXCEPTION 'Tabela instance_groups não foi criada!';
  END IF;

  RAISE NOTICE '✅ Todas as migrações foram aplicadas com sucesso!';
END $$;





