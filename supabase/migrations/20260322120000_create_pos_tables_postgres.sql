-- PDV: tabelas transacionais no PostgreSQL Hetzner (budget_services)
-- Auth/org/leads continuam no Supabase; aqui só vendas, estoque e caixa.

CREATE TABLE IF NOT EXISTS pos_sale_counters (
  organization_id UUID PRIMARY KEY,
  last_number BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pos_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  opened_by UUID,
  opened_by_name TEXT,
  closed_by UUID,
  closed_by_name TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_cash_sessions_org_status
  ON pos_cash_sessions (organization_id, status);

CREATE TABLE IF NOT EXISTS pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_number BIGINT NOT NULL,
  cash_session_id UUID REFERENCES pos_cash_sessions(id),
  lead_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  add_commission BOOLEAN NOT NULL DEFAULT false,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sold_by UUID,
  sold_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, sale_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_sales_org_created
  ON pos_sales (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_org_lead
  ON pos_sales (organization_id, lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_sales_org_status
  ON pos_sales (organization_id, status);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service')),
  item_id UUID,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'un',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_sale
  ON pos_sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_sale_items_org
  ON pos_sale_items (organization_id);

CREATE TABLE IF NOT EXISTS pos_sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  method TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_sale_payments_sale
  ON pos_sale_payments (sale_id);

CREATE TABLE IF NOT EXISTS pos_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  product_id UUID NOT NULL,
  sale_id UUID REFERENCES pos_sales(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'sale_cancel', 'adjustment')),
  quantity_delta NUMERIC(12,3) NOT NULL,
  stock_before NUMERIC(12,3),
  stock_after NUMERIC(12,3),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_org_product
  ON pos_stock_movements (organization_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_sale
  ON pos_stock_movements (sale_id)
  WHERE sale_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_pos_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pos_sales_updated_at ON pos_sales;
CREATE TRIGGER trg_pos_sales_updated_at
  BEFORE UPDATE ON pos_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_sales_updated_at();

COMMENT ON TABLE pos_sales IS 'Vendas do PDV (transacional no Hetzner Postgres)';
COMMENT ON TABLE pos_sale_items IS 'Itens de venda PDV (produto ou serviço)';
COMMENT ON TABLE pos_sale_payments IS 'Formas de pagamento da venda PDV';
COMMENT ON TABLE pos_stock_movements IS 'Movimentações de estoque geradas pelo PDV';
COMMENT ON TABLE pos_cash_sessions IS 'Sessões de caixa (abrir/fechar)';
