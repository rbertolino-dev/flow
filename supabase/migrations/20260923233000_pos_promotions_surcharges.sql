ALTER TABLE pos_settings
  ADD COLUMN IF NOT EXISTS payment_surcharges JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE pos_sales
  ADD COLUMN IF NOT EXISTS surcharge_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pos_settings.payment_surcharges IS 'Acréscimos percentuais por forma de pagamento e faixa de parcelas';
COMMENT ON COLUMN pos_settings.promotions IS 'Promoções percentuais aplicáveis a categorias de produto no PDV';
COMMENT ON COLUMN pos_sales.surcharge_amount IS 'Acréscimo da forma de pagamento somado ao total da venda';
