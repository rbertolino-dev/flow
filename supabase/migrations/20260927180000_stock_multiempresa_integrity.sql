-- Integridade do estoque multiempresa no Postgres do Hetzner.
-- Índices únicos e a FK só são criados quando não há dado conflitante.

ALTER TABLE pos_sales ADD COLUMN IF NOT EXISTS client_request_id TEXT;
ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS budget_id UUID;

CREATE TABLE IF NOT EXISTS budget_stock_posts (
  organization_id UUID NOT NULL,
  budget_id UUID NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, budget_id)
);

CREATE TABLE IF NOT EXISTS product_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  product_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_change_log_org
  ON product_change_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_budget
  ON pos_stock_movements (organization_id, budget_id)
  WHERE budget_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_sale_product
  ON pos_stock_movements (sale_id, product_id)
  WHERE sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_sales_org_request
  ON pos_sales (organization_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM products
    WHERE sku IS NOT NULL AND btrim(sku) <> ''
    GROUP BY organization_id, sku
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'SKU duplicado por empresa: índice único não criado';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_sku_unique
      ON products (organization_id, sku)
      WHERE sku IS NOT NULL AND btrim(sku) <> '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM products
    WHERE barcode IS NOT NULL AND btrim(barcode) <> ''
    GROUP BY organization_id, barcode
    HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Código de barras duplicado por empresa: índice único não criado';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_barcode_unique
      ON products (organization_id, barcode)
      WHERE barcode IS NOT NULL AND btrim(barcode) <> '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pos_stock_movements m
    LEFT JOIN products p ON p.id = m.product_id
    WHERE p.id IS NULL
  ) THEN
    RAISE NOTICE 'Movimento com product_id órfão: FK não criada';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_stock_movements_product_id_fkey'
  ) THEN
    ALTER TABLE pos_stock_movements
      ADD CONSTRAINT pos_stock_movements_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;
END $$;
