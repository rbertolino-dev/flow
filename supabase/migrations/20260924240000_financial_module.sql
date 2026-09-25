-- Módulo financeiro: livro de contas a receber e a pagar, contas e categorias.

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'ambos' CHECK (direction IN ('receber', 'pagar', 'ambos')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name, direction)
);

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('receber', 'pagar')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  settlement_status TEXT NOT NULL DEFAULT 'confirmado' CHECK (settlement_status IN ('previsto', 'confirmado')),
  source_type TEXT NOT NULL CHECK (source_type IN ('orcamento', 'pdv', 'ordem_servico', 'boleto', 'comissao', 'manual')),
  source_id TEXT NOT NULL,
  lead_id UUID,
  budget_id UUID,
  description TEXT,
  contact_name TEXT,
  billing_name TEXT,
  category TEXT,
  account TEXT,
  origin_label TEXT NOT NULL DEFAULT 'Normal',
  gateway_type TEXT,
  gateway_id TEXT,
  covered_by_entry_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_source_unique
  ON public.financial_entries (organization_id, source_type, source_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_financial_entries_org_dir
  ON public.financial_entries (organization_id, direction, status, due_date);

CREATE INDEX IF NOT EXISTS idx_financial_entries_lead
  ON public.financial_entries (organization_id, lead_id)
  WHERE lead_id IS NOT NULL AND status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_financial_entries_gateway
  ON public.financial_entries (organization_id, gateway_type, gateway_id)
  WHERE gateway_id IS NOT NULL AND status <> 'cancelled';

ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_covered_by_fkey;
ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_covered_by_fkey
  FOREIGN KEY (covered_by_entry_id) REFERENCES public.financial_entries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.touch_financial_entry_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_entries_updated_at ON public.financial_entries;
CREATE TRIGGER trg_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_financial_entry_updated_at();

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['financial_accounts', 'financial_categories', 'financial_entries']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_select', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_insert', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_update', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_delete', t);
  END LOOP;
END $$;

INSERT INTO public.financial_accounts (organization_id, name)
SELECT o.id, n.name
FROM public.organizations o
CROSS JOIN (VALUES ('Caixa'), ('Banco'), ('PIX')) AS n(name)
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO public.financial_categories (organization_id, name, direction)
SELECT o.id, c.name, c.direction
FROM public.organizations o
CROSS JOIN (VALUES
  ('Vendas', 'receber'),
  ('Serviços', 'receber'),
  ('Outros', 'ambos'),
  ('Comissão', 'pagar'),
  ('Fornecedores', 'pagar'),
  ('Despesas', 'pagar')
) AS c(name, direction)
ON CONFLICT (organization_id, name, direction) DO NOTHING;

-- Feature do menu Financeiro (aditiva: não substitui o plano)
UPDATE public.plans
SET features = features || '["finance"]'::jsonb
WHERE features IS NOT NULL
  AND jsonb_typeof(features) = 'array'
  AND NOT (features ? 'finance');

UPDATE public.organization_limits
SET enabled_features = enabled_features || '["finance"]'::jsonb
WHERE enabled_features IS NOT NULL
  AND jsonb_typeof(enabled_features) = 'array'
  AND NOT (enabled_features ? 'finance');

CREATE OR REPLACE FUNCTION public.assert_finance_access(p_organization_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Organização obrigatória';
  END IF;

  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Sem permissão para o financeiro desta organização';
  END IF;
END;
$$;

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
  p_gateway_id TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
  v_paid_at TIMESTAMPTZ;
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
  IF p_source_type NOT IN ('orcamento', 'pdv', 'ordem_servico', 'boleto', 'comissao', 'manual') THEN
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
        category = COALESCE(p_category, category),
        account = COALESCE(p_account, account),
        origin_label = COALESCE(p_origin_label, origin_label),
        gateway_type = COALESCE(p_gateway_type, gateway_type),
        gateway_id = COALESCE(p_gateway_id, gateway_id)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.financial_entries (
    organization_id, direction, amount, due_date, paid_at, status, settlement_status,
    source_type, source_id, lead_id, budget_id, description, contact_name, billing_name,
    category, account, origin_label, gateway_type, gateway_id, created_by
  ) VALUES (
    p_organization_id, p_direction, p_amount, COALESCE(p_due_date, CURRENT_DATE),
    CASE WHEN v_status = 'paid' THEN COALESCE(v_paid_at, now()) ELSE NULL END,
    v_status, CASE WHEN v_status = 'paid' THEN 'confirmado' ELSE p_settlement_status END,
    p_source_type, p_source_id, p_lead_id, p_budget_id, p_description, p_contact_name,
    COALESCE(NULLIF(btrim(p_billing_name), ''), 'Sem contato'),
    p_category, p_account, COALESCE(p_origin_label, 'Normal'),
    p_gateway_type, p_gateway_id, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cover_forecast_receivables(
  p_organization_id UUID,
  p_lead_id UUID DEFAULT NULL,
  p_budget_id UUID DEFAULT NULL,
  p_covered_by UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_lead_id IS NULL AND p_budget_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.financial_entries
  SET status = 'cancelled',
      covered_by_entry_id = p_covered_by
  WHERE organization_id = p_organization_id
    AND direction = 'receber'
    AND status = 'open'
    AND settlement_status = 'previsto'
    AND (
      (p_budget_id IS NOT NULL AND budget_id = p_budget_id)
      OR (
        p_lead_id IS NOT NULL
        AND lead_id = p_lead_id
        AND source_type = 'orcamento'
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_financial_by_source(
  p_organization_id UUID,
  p_source_type TEXT,
  p_source_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  UPDATE public.financial_entries
  SET status = 'cancelled'
  WHERE organization_id = p_organization_id
    AND source_type = p_source_type
    AND source_id = p_source_id
    AND status <> 'cancelled';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_financial_by_sale(
  p_organization_id UUID,
  p_sale_id TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_sale_id IS NULL OR btrim(p_sale_id) = '' THEN
    RETURN 0;
  END IF;

  UPDATE public.financial_entries
  SET status = 'cancelled'
  WHERE organization_id = p_organization_id
    AND status <> 'cancelled'
    AND (
      (source_type = 'pdv' AND (source_id = p_sale_id OR source_id LIKE p_sale_id || ':%'))
      OR (source_type = 'comissao' AND source_id = 'pdv:' || p_sale_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_financial_entry_status(
  p_organization_id UUID,
  p_entry_id UUID,
  p_status TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.financial_entries%ROWTYPE;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_status NOT IN ('paid', 'cancelled', 'open') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  SELECT * INTO v_row
  FROM public.financial_entries
  WHERE id = p_entry_id AND organization_id = p_organization_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Lançamento não encontrado';
  END IF;

  UPDATE public.financial_entries
  SET status = p_status,
      settlement_status = CASE WHEN p_status = 'paid' THEN 'confirmado' ELSE settlement_status END,
      paid_at = CASE
        WHEN p_status = 'paid' THEN COALESCE(paid_at, now())
        WHEN p_status = 'open' THEN NULL
        ELSE paid_at
      END
  WHERE id = p_entry_id;

  IF p_status = 'paid' AND v_row.source_type = 'comissao' AND v_row.lead_id IS NOT NULL THEN
    BEGIN
      UPDATE public.seller_commissions
      SET status = 'paid',
          paid_at = COALESCE(paid_at, now())
      WHERE organization_id = p_organization_id
        AND lead_id = v_row.lead_id
        AND status IS DISTINCT FROM 'paid';
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        NULL;
    END;
  END IF;

  RETURN p_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_gateway_receivable(
  p_organization_id UUID,
  p_gateway TEXT,
  p_gateway_id TEXT,
  p_amount NUMERIC,
  p_due_date DATE DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_paid BOOLEAN DEFAULT FALSE,
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_cancel BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.financial_entries%ROWTYPE;
  v_id UUID;
  v_source_id TEXT;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  IF p_gateway IS NULL OR p_gateway_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.financial_entries
  WHERE organization_id = p_organization_id
    AND gateway_type = p_gateway
    AND gateway_id = p_gateway_id
    AND status <> 'cancelled'
  LIMIT 1;

  IF v_row.id IS NULL AND p_lead_id IS NOT NULL AND NOT p_cancel THEN
    SELECT * INTO v_row
    FROM public.financial_entries
    WHERE organization_id = p_organization_id
      AND direction = 'receber'
      AND status = 'open'
      AND lead_id = p_lead_id
      AND gateway_id IS NULL
    ORDER BY CASE WHEN settlement_status = 'previsto' THEN 0 ELSE 1 END, due_date
    LIMIT 1;
  END IF;

  IF p_cancel THEN
    IF v_row.id IS NULL THEN
      RETURN NULL;
    END IF;
    IF v_row.source_type = 'boleto' THEN
      UPDATE public.financial_entries
      SET status = 'cancelled'
      WHERE id = v_row.id;
    ELSE
      UPDATE public.financial_entries
      SET gateway_type = NULL, gateway_id = NULL
      WHERE id = v_row.id;
    END IF;
    RETURN v_row.id;
  END IF;

  IF v_row.id IS NOT NULL THEN
    UPDATE public.financial_entries
    SET gateway_type = p_gateway,
        gateway_id = p_gateway_id,
        amount = CASE WHEN source_type = 'boleto' THEN COALESCE(p_amount, amount) ELSE amount END,
        due_date = COALESCE(p_due_date, due_date),
        description = COALESCE(p_description, description),
        contact_name = COALESCE(p_contact_name, contact_name),
        lead_id = COALESCE(p_lead_id, lead_id),
        status = CASE WHEN p_paid THEN 'paid' ELSE status END,
        settlement_status = CASE WHEN p_paid THEN 'confirmado' ELSE settlement_status END,
        paid_at = CASE WHEN p_paid THEN COALESCE(p_paid_at, paid_at, now()) ELSE paid_at END
    WHERE id = v_row.id;
    RETURN v_row.id;
  END IF;

  v_source_id := p_gateway || ':' || p_gateway_id;
  v_id := public.upsert_financial_entry(
    p_organization_id,
    'receber',
    COALESCE(p_amount, 0),
    COALESCE(p_due_date, CURRENT_DATE),
    'boleto',
    v_source_id,
    CASE WHEN p_paid THEN 'paid' ELSE 'open' END,
    'confirmado',
    p_lead_id,
    NULL,
    COALESCE(p_description, 'Cobrança'),
    p_contact_name,
    'Sem contato',
    'Vendas',
    'Banco',
    'Boleto',
    CASE WHEN p_paid THEN COALESCE(p_paid_at, now()) ELSE NULL END,
    NULL,
    p_gateway,
    p_gateway_id
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_budget_receivable(
  p_organization_id UUID,
  p_budget_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget RECORD;
  v_due DATE;
  v_contact TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  SELECT id, organization_id, budget_number, lead_id, client_data, total,
         delivery_date, expires_at, approved, rejected
  INTO v_budget
  FROM public.budgets
  WHERE id = p_budget_id AND organization_id = p_organization_id;

  IF v_budget.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(v_budget.rejected, false) OR NOT COALESCE(v_budget.approved, false) THEN
    PERFORM public.cancel_financial_by_source(p_organization_id, 'orcamento', v_budget.id::text);
    RETURN NULL;
  END IF;

  v_contact := COALESCE(
    NULLIF(v_budget.client_data->>'name', ''),
    NULLIF(v_budget.client_data->>'company', ''),
    'Cliente'
  );
  v_due := COALESCE(v_budget.delivery_date::date, v_budget.expires_at::date, CURRENT_DATE);

  v_id := public.upsert_financial_entry(
    p_organization_id,
    'receber',
    COALESCE(v_budget.total, 0),
    v_due,
    'orcamento',
    v_budget.id::text,
    'open',
    'previsto',
    v_budget.lead_id,
    v_budget.id,
    'Orçamento ' || COALESCE(v_budget.budget_number, ''),
    v_contact,
    'Sem contato',
    'Vendas',
    'Caixa',
    'Orçamento',
    NULL,
    auth.uid()
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_service_order_finance(
  p_organization_id UUID,
  p_order_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_has_budget BOOLEAN;
  v_contact TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_finance_access(p_organization_id);

  SELECT id, lead_id, client_name, total, has_commission, commission_value,
         collaborator_name, responsible_name, code, is_closed, deleted_at
  INTO v_order
  FROM public.service_orders
  WHERE id = p_order_id AND organization_id = p_organization_id;

  IF v_order.id IS NULL
     OR v_order.deleted_at IS NOT NULL
     OR NOT COALESCE(v_order.is_closed, false) THEN
    PERFORM public.cancel_financial_by_source(p_organization_id, 'ordem_servico', p_order_id::text);
    PERFORM public.cancel_financial_by_source(p_organization_id, 'comissao', 'os:' || p_order_id::text);
    RETURN NULL;
  END IF;

  v_has_budget := FALSE;
  IF v_order.lead_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.financial_entries
      WHERE organization_id = p_organization_id
        AND direction = 'receber'
        AND status <> 'cancelled'
        AND source_type = 'orcamento'
        AND lead_id = v_order.lead_id
    ) INTO v_has_budget;
  END IF;

  v_contact := COALESCE(NULLIF(v_order.client_name, ''), 'Cliente');

  IF v_has_budget THEN
    PERFORM public.cancel_financial_by_source(p_organization_id, 'ordem_servico', p_order_id::text);
    v_id := NULL;
  ELSE
    v_id := public.upsert_financial_entry(
      p_organization_id,
      'receber',
      COALESCE(v_order.total, 0),
      CURRENT_DATE,
      'ordem_servico',
      p_order_id::text,
      'open',
      'confirmado',
      v_order.lead_id,
      NULL,
      'OS ' || COALESCE(v_order.code, ''),
      v_contact,
      'Sem contato',
      'Serviços',
      'Caixa',
      'Ordem de serviço',
      NULL,
      auth.uid()
    );
  END IF;

  IF COALESCE(v_order.has_commission, false) AND COALESCE(v_order.commission_value, 0) > 0 THEN
    PERFORM public.upsert_financial_entry(
      p_organization_id,
      'pagar',
      v_order.commission_value,
      CURRENT_DATE,
      'comissao',
      'os:' || p_order_id::text,
      'open',
      'confirmado',
      v_order.lead_id,
      NULL,
      'Comissão OS ' || COALESCE(v_order.code, ''),
      COALESCE(NULLIF(v_order.collaborator_name, ''), NULLIF(v_order.responsible_name, ''), 'Vendedor'),
      'Sem contato',
      'Comissão',
      'Caixa',
      'Comissão',
      NULL,
      auth.uid()
    );
  ELSE
    PERFORM public.cancel_financial_by_source(p_organization_id, 'comissao', 'os:' || p_order_id::text);
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_finance_access(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_financial_entry(
  UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cover_forecast_receivables(UUID, UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_financial_by_source(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_financial_by_sale(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_financial_entry_status(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attach_gateway_receivable(
  UUID, TEXT, TEXT, NUMERIC, DATE, UUID, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, BOOLEAN
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_budget_receivable(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_service_order_finance(UUID, UUID) TO authenticated, service_role;

GRANT ALL ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_entries TO authenticated;
