ALTER TABLE pos_settings
  ADD COLUMN IF NOT EXISTS payment_discounts JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pos_settings.payment_discounts IS 'Descontos percentuais à vista por forma de pagamento do PDV';
