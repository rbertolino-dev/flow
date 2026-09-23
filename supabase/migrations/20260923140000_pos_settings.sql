-- Configurações do PDV por organização (PostgreSQL Hetzner / budget_services)

CREATE TABLE IF NOT EXISTS pos_settings (
  organization_id UUID PRIMARY KEY,
  sale_notes TEXT NOT NULL DEFAULT '',
  financial_account TEXT NOT NULL DEFAULT '',
  financial_category TEXT NOT NULL DEFAULT '',
  default_lead_id UUID,
  default_lead_name TEXT,
  simple_sale BOOLEAN NOT NULL DEFAULT false,
  commission_required BOOLEAN NOT NULL DEFAULT false,
  show_payment_method BOOLEAN NOT NULL DEFAULT true,
  commission_type TEXT NOT NULL DEFAULT 'percent' CHECK (commission_type IN ('percent', 'fixed')),
  commission_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_code_field TEXT NOT NULL DEFAULT 'sku' CHECK (stock_code_field IN ('sku', 'barcode')),
  block_out_of_stock BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE pos_settings IS 'Preferências do PDV que alteram a tela de venda da organização';
