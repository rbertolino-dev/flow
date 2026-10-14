-- Conciliação bancária OFX: source_type ofx + tabelas de extrato.

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_source_type_check;

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_source_type_check
  CHECK (source_type IN ('orcamento', 'pdv', 'ordem_servico', 'boleto', 'comissao', 'manual', 'ofx'));

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS bank_fit_id TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_line_id UUID;

CREATE INDEX IF NOT EXISTS idx_financial_entries_bank_fit_id
  ON public.financial_entries (organization_id, bank_fit_id)
  WHERE bank_fit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_financial_entry(
  p_organization_id UUID,
  p_direction TEXT,
  p_amount NUMERIC,
  p_due_date DATE,
  p_source_type TEXT,
  p_source_id TEXT,
  p_status TEXT DEFAULT 'open',
  p_settlement_status TEXT DEFAULT 'confirmado',
  p_lead_id UUID DEFAULT NULL,
  p_budget_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_billing_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_account TEXT DEFAULT NULL,
  p_origin_label TEXT DEFAULT 'Normal',
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_gateway_type TEXT DEFAULT NULL,
  p_gateway_id TEXT DEFAULT NULL,
  p_competence_date DATE DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_attachment_name TEXT DEFAULT NULL,
  p_is_recurring BOOLEAN DEFAULT false
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
  v_paid_at TIMESTAMPTZ;
  v_category TEXT;
  v_category_id UUID;
  v_competence DATE;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN NULL;
  END IF;

  IF p_direction NOT IN ('receber', 'pagar') THEN
    RAISE EXCEPTION 'Direção inválida';
  END IF;
  IF p_status NOT IN ('open', 'paid', 'cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF p_settlement_status NOT IN ('previsto', 'confirmado') THEN
    RAISE EXCEPTION 'Situação inválida';
  END IF;
  IF p_source_type NOT IN ('orcamento', 'pdv', 'ordem_servico', 'boleto', 'comissao', 'manual', 'ofx') THEN
    RAISE EXCEPTION 'Origem inválida';
  END IF;
  IF p_source_id IS NULL OR btrim(p_source_id) = '' THEN
    RAISE EXCEPTION 'source_id obrigatório';
  END IF;

  v_status := p_status;
  v_paid_at := p_paid_at;
  IF v_status = 'paid' AND v_paid_at IS NULL THEN
    v_paid_at := now();
  END IF;

  v_category := NULLIF(btrim(COALESCE(p_category, '')), '');
  v_category_id := p_category_id;
  v_competence := COALESCE(p_competence_date, p_due_date, CURRENT_DATE);

  IF v_category_id IS NOT NULL AND v_category IS NULL THEN
    SELECT name INTO v_category
    FROM public.financial_categories
    WHERE id = v_category_id
      AND organization_id = p_organization_id;
  END IF;

  IF v_category_id IS NULL AND v_category IS NOT NULL THEN
    SELECT id INTO v_category_id
    FROM public.financial_categories
    WHERE organization_id = p_organization_id
      AND name = v_category
      AND direction IN (p_direction, 'ambos')
    ORDER BY CASE WHEN direction = p_direction THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  SELECT id INTO v_id
  FROM public.financial_entries
  WHERE organization_id = p_organization_id
    AND source_type = p_source_type
    AND source_id = p_source_id
    AND status <> 'cancelled'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.financial_entries
    SET direction = p_direction,
        amount = p_amount,
        due_date = COALESCE(p_due_date, due_date),
        competence_date = COALESCE(p_competence_date, competence_date, p_due_date, due_date),
        status = CASE
          WHEN status = 'paid' AND v_status = 'open' THEN 'paid'
          ELSE v_status
        END,
        settlement_status = CASE
          WHEN status = 'paid' OR v_status = 'paid' THEN 'confirmado'
          ELSE p_settlement_status
        END,
        paid_at = CASE
          WHEN status = 'paid' AND v_status = 'open' THEN paid_at
          WHEN v_status = 'paid' THEN COALESCE(v_paid_at, paid_at, now())
          ELSE paid_at
        END,
        lead_id = COALESCE(p_lead_id, lead_id),
        budget_id = COALESCE(p_budget_id, budget_id),
        description = COALESCE(p_description, description),
        contact_name = COALESCE(p_contact_name, contact_name),
        billing_name = COALESCE(p_billing_name, billing_name),
        category = COALESCE(v_category, category),
        category_id = COALESCE(v_category_id, category_id),
        account = COALESCE(p_account, account),
        origin_label = COALESCE(p_origin_label, origin_label),
        gateway_type = COALESCE(p_gateway_type, gateway_type),
        gateway_id = COALESCE(p_gateway_id, gateway_id),
        payment_method = COALESCE(p_payment_method, payment_method),
        attachment_name = COALESCE(p_attachment_name, attachment_name),
        is_recurring = COALESCE(p_is_recurring, is_recurring)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.financial_entries (
    organization_id, direction, amount, due_date, competence_date, paid_at, status, settlement_status,
    source_type, source_id, lead_id, budget_id, description, contact_name, billing_name,
    category, category_id, account, origin_label, gateway_type, gateway_id, created_by,
    payment_method, attachment_name, is_recurring
  ) VALUES (
    p_organization_id, p_direction, p_amount, COALESCE(p_due_date, CURRENT_DATE), v_competence,
    CASE WHEN v_status = 'paid' THEN COALESCE(v_paid_at, now()) ELSE NULL END,
    v_status, CASE WHEN v_status = 'paid' THEN 'confirmado' ELSE p_settlement_status END,
    p_source_type, p_source_id, p_lead_id, p_budget_id, p_description, p_contact_name,
    COALESCE(NULLIF(btrim(p_billing_name), ''), 'Sem contato'),
    v_category, v_category_id, p_account, COALESCE(p_origin_label, 'Normal'),
    p_gateway_type, p_gateway_id, p_created_by,
    p_payment_method, p_attachment_name, COALESCE(p_is_recurring, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_financial_entry(
  UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, DATE, UUID, TEXT, TEXT, BOOLEAN
) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  account_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_org
  ON public.bank_reconciliations (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bank_reconciliation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fit_id TEXT NOT NULL,
  trn_type TEXT,
  posted_at DATE NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('receber', 'pagar')),
  memo TEXT,
  payee_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'linked', 'skipped')),
  entry_id UUID REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  description TEXT,
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  category TEXT,
  contact_name TEXT,
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, fit_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_lines_recon
  ON public.bank_reconciliation_lines (reconciliation_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_reconciliation_lines_org_status
  ON public.bank_reconciliation_lines (organization_id, status, posted_at);

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_reconciliation_line_fkey;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_reconciliation_line_fkey
  FOREIGN KEY (reconciliation_line_id) REFERENCES public.bank_reconciliation_lines(id) ON DELETE SET NULL;

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_reconciliations_select ON public.bank_reconciliations;
DROP POLICY IF EXISTS bank_reconciliations_insert ON public.bank_reconciliations;
DROP POLICY IF EXISTS bank_reconciliations_update ON public.bank_reconciliations;
DROP POLICY IF EXISTS bank_reconciliations_delete ON public.bank_reconciliations;

CREATE POLICY bank_reconciliations_select ON public.bank_reconciliations FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliations_insert ON public.bank_reconciliations FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliations_update ON public.bank_reconciliations FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliations_delete ON public.bank_reconciliations FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS bank_reconciliation_lines_select ON public.bank_reconciliation_lines;
DROP POLICY IF EXISTS bank_reconciliation_lines_insert ON public.bank_reconciliation_lines;
DROP POLICY IF EXISTS bank_reconciliation_lines_update ON public.bank_reconciliation_lines;
DROP POLICY IF EXISTS bank_reconciliation_lines_delete ON public.bank_reconciliation_lines;

CREATE POLICY bank_reconciliation_lines_select ON public.bank_reconciliation_lines FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliation_lines_insert ON public.bank_reconciliation_lines FOR INSERT WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliation_lines_update ON public.bank_reconciliation_lines FOR UPDATE USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
CREATE POLICY bank_reconciliation_lines_delete ON public.bank_reconciliation_lines FOR DELETE USING (
  organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);
