begin;

-- 1) Corrigir dados existentes: alinhar organização da fila com a do lead
UPDATE public.call_queue cq
SET organization_id = l.organization_id
FROM public.leads l
WHERE cq.lead_id = l.id
  AND (cq.organization_id IS DISTINCT FROM l.organization_id);

UPDATE public.call_queue_history h
SET organization_id = l.organization_id
FROM public.leads l
WHERE h.lead_id = l.id
  AND (h.organization_id IS DISTINCT FROM l.organization_id);

-- 2) Garantir consistência daqui pra frente com gatilhos
CREATE OR REPLACE FUNCTION public.set_call_queue_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_org IS NOT NULL THEN
    NEW.organization_id := v_org;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_call_queue_org ON public.call_queue;
CREATE TRIGGER trg_set_call_queue_org
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_organization();

CREATE OR REPLACE FUNCTION public.set_call_queue_history_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT organization_id INTO v_org
  FROM public.leads
  WHERE id = NEW.lead_id;

  IF v_org IS NOT NULL THEN
    NEW.organization_id := v_org;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_call_queue_history_org ON public.call_queue_history;
CREATE TRIGGER trg_set_call_queue_history_org
BEFORE INSERT OR UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_history_organization();

commit;