CREATE TABLE IF NOT EXISTS public.financial_entry_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  entry_id UUID NOT NULL REFERENCES public.financial_entries(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'edited')),
  actor_id UUID,
  actor_name TEXT,
  amount NUMERIC(14,2),
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_entry_logs_entry
  ON public.financial_entry_logs (entry_id, created_at);

ALTER TABLE public.financial_entry_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_entry_logs_select ON public.financial_entry_logs;
CREATE POLICY financial_entry_logs_select ON public.financial_entry_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON public.financial_entry_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.log_financial_entry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_name TEXT;
  v_changes JSONB := '[]'::jsonb;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    v_actor := NEW.created_by;
  END IF;

  SELECT COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(email), ''))
  INTO v_name
  FROM public.profiles
  WHERE id = v_actor;

  IF v_name IS NULL THEN
    v_name := 'Sistema';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_entry_logs (
      organization_id, entry_id, event_type, actor_id, actor_name, amount
    ) VALUES (
      NEW.organization_id, NEW.id, 'created', v_actor, v_name, NEW.amount
    );
    RETURN NEW;
  END IF;

  IF NEW.description IS DISTINCT FROM OLD.description THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'description', 'from', OLD.description, 'to', NEW.description));
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'amount', 'from', OLD.amount, 'to', NEW.amount));
  END IF;
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'due_date', 'from', OLD.due_date, 'to', NEW.due_date));
  END IF;
  IF NEW.competence_date IS DISTINCT FROM OLD.competence_date THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'competence_date', 'from', OLD.competence_date, 'to', NEW.competence_date));
  END IF;
  IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'paid_at', 'from', OLD.paid_at, 'to', NEW.paid_at));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'status', 'from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.account IS DISTINCT FROM OLD.account THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'account', 'from', OLD.account, 'to', NEW.account));
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'category', 'from', OLD.category, 'to', NEW.category));
  END IF;
  IF NEW.contact_name IS DISTINCT FROM OLD.contact_name THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'contact_name', 'from', OLD.contact_name, 'to', NEW.contact_name));
  END IF;
  IF NEW.billing_name IS DISTINCT FROM OLD.billing_name THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'billing_name', 'from', OLD.billing_name, 'to', NEW.billing_name));
  END IF;
  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'payment_method', 'from', OLD.payment_method, 'to', NEW.payment_method));
  END IF;
  IF NEW.is_recurring IS DISTINCT FROM OLD.is_recurring THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'is_recurring', 'from', OLD.is_recurring, 'to', NEW.is_recurring));
  END IF;
  IF NEW.attachment_name IS DISTINCT FROM OLD.attachment_name THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'attachment_name', 'from', OLD.attachment_name, 'to', NEW.attachment_name));
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object('field', 'notes', 'from', OLD.notes, 'to', NEW.notes));
  END IF;

  IF jsonb_array_length(v_changes) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.financial_entry_logs (
    organization_id, entry_id, event_type, actor_id, actor_name, changes
  ) VALUES (
    NEW.organization_id, NEW.id, 'edited', v_actor, v_name, v_changes
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_financial_entry_change ON public.financial_entries;
CREATE TRIGGER trg_log_financial_entry_change
  AFTER INSERT OR UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.log_financial_entry_change();
