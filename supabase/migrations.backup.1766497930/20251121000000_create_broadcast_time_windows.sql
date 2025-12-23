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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Índices para performance
DROP INDEX IF EXISTS idx_broadcast_time_windows_org CASCADE;
CREATE INDEX idx_broadcast_time_windows_org ON
CREATE INDEX idx_broadcast_time_windows_org ON public.broadcast_time_windows(organization_id);
DROP INDEX IF EXISTS idx_broadcast_time_windows_enabled CASCADE;
CREATE INDEX idx_broadcast_time_windows_enabled ON
CREATE INDEX idx_broadcast_time_windows_enabled ON public.broadcast_time_windows(organization_id, enabled);

-- Habilitar RLS
ALTER TABLE public.broadcast_time_windows ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view time windows of their organization"
ON public.broadcast_time_windows
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
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
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_broadcast_time_windows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_broadcast_time_windows_updated_at
BEFORE UPDATE ON public.broadcast_time_windows
FOR EACH ROW
EXECUTE FUNCTION update_broadcast_time_windows_updated_at();

-- Função para verificar se um horário está dentro da janela permitida
CREATE OR REPLACE FUNCTION is_time_in_window(
  _org_id UUID,
  _check_time TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window RECORD;
  _day_of_week INTEGER;
  _time_only TIME;
  _start_time TIME;
  _end_time TIME;
BEGIN
  -- Se não há janela configurada, permite (comportamento padrão)
  SELECT * INTO _window
  FROM broadcast_time_windows
  WHERE organization_id = _org_id
    AND enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN true; -- Sem janela = permite sempre
  END IF;

  -- Obter dia da semana (0 = domingo, 1 = segunda, ..., 6 = sábado)
  _day_of_week := EXTRACT(DOW FROM _check_time);
  _time_only := _check_time::TIME;

  -- Determinar horários de início e fim baseado no dia
  CASE _day_of_week
    WHEN 1 THEN -- Segunda
      _start_time := _window.monday_start;
      _end_time := _window.monday_end;
    WHEN 2 THEN -- Terça
      _start_time := _window.tuesday_start;
      _end_time := _window.tuesday_end;
    WHEN 3 THEN -- Quarta
      _start_time := _window.wednesday_start;
      _end_time := _window.wednesday_end;
    WHEN 4 THEN -- Quinta
      _start_time := _window.thursday_start;
      _end_time := _window.thursday_end;
    WHEN 5 THEN -- Sexta
      _start_time := _window.friday_start;
      _end_time := _window.friday_end;
    WHEN 6 THEN -- Sábado
      _start_time := _window.saturday_start;
      _end_time := _window.saturday_end;
    WHEN 0 THEN -- Domingo
      _start_time := _window.sunday_start;
      _end_time := _window.sunday_end;
  END CASE;

  -- Se não há horário configurado para o dia, não permite
  IF _start_time IS NULL OR _end_time IS NULL THEN
    RETURN false;
  END IF;

  -- Verificar se está dentro do horário
  IF _start_time <= _end_time THEN
    -- Horário normal (ex: 09:00 - 18:00)
    RETURN _time_only >= _start_time AND _time_only <= _end_time;
  ELSE
    -- Horário que cruza meia-noite (ex: 22:00 - 02:00)
    RETURN _time_only >= _start_time OR _time_only <= _end_time;
  END IF;
END;
$$;

