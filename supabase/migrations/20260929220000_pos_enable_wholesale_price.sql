-- Habilita preço de atacado nas configurações do PDV (Hetzner / budget_services)
ALTER TABLE pos_settings
  ADD COLUMN IF NOT EXISTS enable_wholesale_price BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN pos_settings.enable_wholesale_price IS
  'Quando true, libera cadastro de preço atacado e abas Varejo/Atacado no PDV';
