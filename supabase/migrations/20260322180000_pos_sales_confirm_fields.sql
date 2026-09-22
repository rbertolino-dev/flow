-- Campos extras do fluxo Confirmar venda (comissão por usuário, flags, financeiro)
ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS commission_user_id UUID,
  ADD COLUMN IF NOT EXISTS commission_user_name TEXT,
  ADD COLUMN IF NOT EXISTS apply_stock BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS generate_financial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_date DATE,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT,
  ADD COLUMN IF NOT EXISTS sale_description TEXT,
  ADD COLUMN IF NOT EXISTS financial_account TEXT,
  ADD COLUMN IF NOT EXISTS financial_category TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_sales_commission_user
  ON pos_sales (organization_id, commission_user_id)
  WHERE commission_user_id IS NOT NULL;

COMMENT ON COLUMN pos_sales.commission_user_id IS 'Usuário da org vinculado à comissão da venda';
COMMENT ON COLUMN pos_sales.apply_stock IS 'Se true, baixa estoque ao finalizar';
COMMENT ON COLUMN pos_sales.generate_financial IS 'Flag para gerar lançamento financeiro (integração futura)';
