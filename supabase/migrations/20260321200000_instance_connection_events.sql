-- Histórico de desconexões/reconexões por instância (evolution_config.is_connected)
-- Mês calendário em America/Sao_Paulo para alinhar ao uso no Brasil.

CREATE TABLE IF NOT EXISTS public.instance_connection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('disconnect', 'reconnect')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instance_connection_events_instance_time
  ON public.instance_connection_events (instance_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_instance_connection_events_org_time
  ON public.instance_connection_events (organization_id, occurred_at DESC);

COMMENT ON TABLE public.instance_connection_events IS
  'Transições de is_connected na evolution_config: disconnect (true→não true), reconnect (não true→true).';

ALTER TABLE public.instance_connection_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instance_connection_events_select_org" ON public.instance_connection_events;

CREATE POLICY "instance_connection_events_select_org"
  ON public.instance_connection_events FOR SELECT TO authenticated
  USING (
    public.user_belongs_to_org(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Inserção apenas via trigger (função SECURITY DEFINER); usuários não inserem direto.

CREATE OR REPLACE FUNCTION public.log_evolution_instance_connection_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.is_connected IS NOT DISTINCT FROM NEW.is_connected THEN
    RETURN NEW;
  END IF;

  v_org := NEW.organization_id;
  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reconexão: passou a conectado (true)
  IF NEW.is_connected IS TRUE AND (OLD.is_connected IS NOT TRUE) THEN
    INSERT INTO public.instance_connection_events (instance_id, organization_id, event_kind, occurred_at)
    VALUES (NEW.id, v_org, 'reconnect', now());
  -- Desconexão: estava conectado e deixou de estar
  ELSIF OLD.is_connected IS TRUE AND (NEW.is_connected IS NOT TRUE) THEN
    INSERT INTO public.instance_connection_events (instance_id, organization_id, event_kind, occurred_at)
    VALUES (NEW.id, v_org, 'disconnect', now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_evolution_instance_connection ON public.evolution_config;

CREATE TRIGGER trg_log_evolution_instance_connection
  AFTER UPDATE OF is_connected ON public.evolution_config
  FOR EACH ROW
  EXECUTE FUNCTION public.log_evolution_instance_connection_transition();

CREATE OR REPLACE FUNCTION public.get_instance_connection_month_stats(p_instance_id uuid)
RETURNS TABLE(
  disconnects bigint,
  reconnects bigint,
  month_start_local date
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_local timestamp;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, NULL::date;
    RETURN;
  END IF;

  SELECT c.organization_id INTO v_org
  FROM public.evolution_config c
  WHERE c.id = p_instance_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.user_belongs_to_org(auth.uid(), v_org)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RETURN QUERY SELECT 0::bigint, 0::bigint, NULL::date;
    RETURN;
  END IF;

  v_local := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_start := (date_trunc('month', v_local) AT TIME ZONE 'America/Sao_Paulo');
  v_end := ((date_trunc('month', v_local) + interval '1 month') AT TIME ZONE 'America/Sao_Paulo');

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::bigint
     FROM public.instance_connection_events e
     WHERE e.instance_id = p_instance_id
       AND e.event_kind = 'disconnect'
       AND e.occurred_at >= v_start
       AND e.occurred_at < v_end),
    (SELECT COUNT(*)::bigint
     FROM public.instance_connection_events e
     WHERE e.instance_id = p_instance_id
       AND e.event_kind = 'reconnect'
       AND e.occurred_at >= v_start
       AND e.occurred_at < v_end),
    (date_trunc('month', v_local))::date;
END;
$$;

COMMENT ON FUNCTION public.get_instance_connection_month_stats(uuid) IS
  'Contagens de desconexões e reconexões no mês corrente (calendário America/Sao_Paulo).';

GRANT EXECUTE ON FUNCTION public.get_instance_connection_month_stats(uuid) TO authenticated;
