-- Código de barras do produto (leitor no PDV)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_products_org_barcode
  ON products (organization_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

COMMENT ON COLUMN products.barcode IS 'Código de barras (EAN) usado no PDV';
