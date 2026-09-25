-- Campos do formulário e lançamento dos orçamentos aprovados que ficaram de fora.

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

INSERT INTO public.financial_entries (
  organization_id, direction, amount, due_date, competence_date, status, settlement_status,
  source_type, source_id, lead_id, budget_id, description, contact_name, billing_name,
  category, category_id, account, origin_label
)
SELECT
  budget.organization_id,
  'receber',
  budget.total,
  COALESCE(budget.delivery_date::date, budget.expires_at::date, CURRENT_DATE),
  COALESCE(budget.delivery_date::date, budget.expires_at::date, CURRENT_DATE),
  'open',
  'previsto',
  'orcamento',
  budget.id::text,
  budget.lead_id,
  budget.id,
  'Orçamento ' || COALESCE(budget.budget_number, ''),
  COALESCE(NULLIF(budget.client_data->>'name', ''), NULLIF(budget.client_data->>'company', ''), 'Cliente'),
  'Sem contato',
  'Vendas',
  (
    SELECT category.id
    FROM public.financial_categories AS category
    WHERE category.organization_id = budget.organization_id
      AND lower(category.name) = 'vendas'
      AND category.direction IN ('receber', 'ambos')
    ORDER BY CASE WHEN category.direction = 'receber' THEN 0 ELSE 1 END
    LIMIT 1
  ),
  'Caixa',
  'Orçamento'
FROM public.budgets AS budget
WHERE COALESCE(budget.approved, false)
  AND NOT COALESCE(budget.rejected, false)
  AND COALESCE(budget.total, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.financial_entries AS entry
    WHERE entry.organization_id = budget.organization_id
      AND entry.source_type = 'orcamento'
      AND entry.source_id = budget.id::text
      AND entry.status <> 'cancelled'
  );
