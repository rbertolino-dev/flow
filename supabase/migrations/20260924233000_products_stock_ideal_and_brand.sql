-- Campos usados pelo módulo de Estoque (limite ideal e marca).
ALTER TABLE products ADD COLUMN IF NOT EXISTS ideal_stock NUMERIC(12,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;
