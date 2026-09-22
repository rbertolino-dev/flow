-- Origem da venda e campos de nota fiscal (filtros do histórico)
ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS sale_origin TEXT NOT NULL DEFAULT 'pdv',
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pos_sales_org_origin
  ON pos_sales (organization_id, sale_origin);

CREATE INDEX IF NOT EXISTS idx_pos_sales_org_invoice
  ON pos_sales (organization_id)
  WHERE invoice_number IS NOT NULL;

COMMENT ON COLUMN pos_sales.sale_origin IS 'Origem da venda: pdv, orcamento, importacao';
COMMENT ON COLUMN pos_sales.invoice_number IS 'Número da NF emitida (null = sem nota)';
