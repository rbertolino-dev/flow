ALTER TABLE pos_stock_movements DROP CONSTRAINT IF EXISTS pos_stock_movements_movement_type_check;
ALTER TABLE pos_stock_movements
  ADD CONSTRAINT pos_stock_movements_movement_type_check
  CHECK (movement_type IN ('sale', 'sale_cancel', 'adjustment', 'in', 'out', 'adjust', 'return', 'exchange'));

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS product_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_org ON product_categories (organization_id, name);
CREATE INDEX IF NOT EXISTS idx_product_brands_org ON product_brands (organization_id, name);
