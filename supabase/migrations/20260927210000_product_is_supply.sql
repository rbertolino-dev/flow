ALTER TABLE products ADD COLUMN IF NOT EXISTS is_supply BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE pos_stock_movements ADD COLUMN IF NOT EXISTS service_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_service_order
  ON pos_stock_movements (organization_id, service_order_id)
  WHERE service_order_id IS NOT NULL;
