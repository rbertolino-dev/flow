-- Orçamento recusado pelo cliente (exclusivo com approved)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS rejected BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_approved_rejected_exclusive;

ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_approved_rejected_exclusive
  CHECK (NOT (COALESCE(approved, false) AND COALESCE(rejected, false)));

CREATE INDEX IF NOT EXISTS idx_budgets_org_lead
  ON public.budgets (organization_id, lead_id)
  WHERE lead_id IS NOT NULL;

COMMENT ON COLUMN public.budgets.rejected IS 'Indica se o orçamento foi recusado pelo cliente';
