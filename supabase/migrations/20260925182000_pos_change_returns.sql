ALTER TABLE public.pos_sale_payments
  ADD COLUMN IF NOT EXISTS tendered_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.pos_stock_movements
  DROP CONSTRAINT IF EXISTS pos_stock_movements_movement_type_check;

ALTER TABLE public.pos_stock_movements
  ADD CONSTRAINT pos_stock_movements_movement_type_check
  CHECK (movement_type IN ('sale', 'sale_cancel', 'adjustment', 'in', 'out', 'adjust', 'return', 'exchange'));

CREATE TABLE IF NOT EXISTS public.pos_sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('return', 'exchange')),
  returned_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  replacement_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  settlement_method TEXT,
  settle_now BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_sale_returns_sale_idx
  ON public.pos_sale_returns (sale_id);

CREATE TABLE IF NOT EXISTS public.pos_sale_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.pos_sale_returns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('returned', 'replacement')),
  sale_item_id UUID,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service')),
  item_id UUID,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_sale_return_items_return_idx
  ON public.pos_sale_return_items (return_id);
