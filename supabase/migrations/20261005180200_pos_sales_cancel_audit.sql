-- Auditoria da exclusão de venda no PDV (PostgreSQL budget_services).

ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID,
  ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT,
  ADD COLUMN IF NOT EXISTS finance_reversed BOOLEAN NOT NULL DEFAULT false;

UPDATE pos_sales
SET cancelled_at = updated_at
WHERE status = 'cancelled'
  AND cancelled_at IS NULL;

COMMENT ON COLUMN pos_sales.cancelled_at IS 'Quando a venda foi excluída';
COMMENT ON COLUMN pos_sales.cancelled_by_name IS 'Quem excluiu a venda';
COMMENT ON COLUMN pos_sales.finance_reversed IS 'Se o estorno financeiro foi aplicado na exclusão';
