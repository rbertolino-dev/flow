-- Datas do lançamento e plano de contas com classificação da DRE.

ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS dre_class TEXT;

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS competence_date DATE;

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL;

UPDATE public.financial_entries
SET competence_date = due_date
WHERE competence_date IS NULL;

UPDATE public.financial_categories
SET dre_class = CASE name
  WHEN 'Vendas' THEN 'receita_vendas'
  WHEN 'Serviços' THEN 'receita_servicos'
  WHEN 'Outros' THEN 'outras_receitas'
  WHEN 'Comissão' THEN 'despesa_operacional'
  WHEN 'Fornecedores' THEN 'custo'
  WHEN 'Despesas' THEN 'despesa_operacional'
  ELSE dre_class
END
WHERE dre_class IS NULL;

UPDATE public.financial_entries AS entry
SET category_id = category.id
FROM public.financial_categories AS category
WHERE entry.category_id IS NULL
  AND entry.category IS NOT NULL
  AND category.organization_id = entry.organization_id
  AND category.name = entry.category
  AND category.direction IN (entry.direction, 'ambos');

CREATE INDEX IF NOT EXISTS idx_financial_entries_competence
  ON public.financial_entries (organization_id, competence_date);

CREATE INDEX IF NOT EXISTS idx_financial_entries_category
  ON public.financial_entries (category_id)
  WHERE category_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.upsert_financial_entry(
  UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT
);

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
  p_category_id UUID DEFAULT NULL
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
        gateway_id = COALESCE(p_gateway_id, gateway_id)
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.financial_entries (
    organization_id, direction, amount, due_date, competence_date, paid_at, status, settlement_status,
    source_type, source_id, lead_id, budget_id, description, contact_name, billing_name,
    category, category_id, account, origin_label, gateway_type, gateway_id, created_by
  ) VALUES (
    p_organization_id, p_direction, p_amount, COALESCE(p_due_date, CURRENT_DATE), v_competence,
    CASE WHEN v_status = 'paid' THEN COALESCE(v_paid_at, now()) ELSE NULL END,
    v_status, CASE WHEN v_status = 'paid' THEN 'confirmado' ELSE p_settlement_status END,
    p_source_type, p_source_id, p_lead_id, p_budget_id, p_description, p_contact_name,
    COALESCE(NULLIF(btrim(p_billing_name), ''), 'Sem contato'),
    v_category, v_category_id, p_account, COALESCE(p_origin_label, 'Normal'),
    p_gateway_type, p_gateway_id, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.set_financial_entry_status(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.set_financial_entry_status(
  p_organization_id UUID,
  p_entry_id UUID,
  p_status TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT NULL
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
        WHEN p_status = 'paid' THEN COALESCE(p_paid_at, paid_at, now())
        WHEN p_status = 'open' THEN NULL
        ELSE paid_at
      END,
      competence_date = COALESCE(competence_date, due_date)
  WHERE id = p_entry_id;

  IF p_status = 'paid' AND v_row.source_type = 'comissao' AND v_row.lead_id IS NOT NULL THEN
    BEGIN
      UPDATE public.seller_commissions
      SET status = 'paid',
          paid_at = COALESCE(p_paid_at, paid_at, now())
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

GRANT EXECUTE ON FUNCTION public.upsert_financial_entry(
  UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID, TEXT, TEXT, DATE, UUID
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.set_financial_entry_status(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
