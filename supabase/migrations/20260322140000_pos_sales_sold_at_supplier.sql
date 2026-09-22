-- PDV: data da venda editável + fornecedor opcional
-- Aplicar no PostgreSQL Hetzner (budget_services)

ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- Preencher sold_at com created_at onde ainda estiver nulo
UPDATE pos_sales
SET sold_at = created_at
WHERE sold_at IS NULL;

ALTER TABLE pos_sales
  ALTER COLUMN sold_at SET DEFAULT now();

-- Índice para filtros por data da venda
CREATE INDEX IF NOT EXISTS idx_pos_sales_org_sold_at
  ON pos_sales (organization_id, sold_at DESC);

COMMENT ON COLUMN pos_sales.sold_at IS 'Data/hora da venda (editável no comprovante)';
COMMENT ON COLUMN pos_sales.supplier_name IS 'Fornecedor opcional da venda';
