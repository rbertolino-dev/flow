-- Preço de atacado no catálogo (Hetzner budget_services / products).
-- Também aplicado em runtime por ensureStockSchema na edge function products.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2);
