DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'stock_quantity'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.products
      ALTER COLUMN stock_quantity TYPE NUMERIC(12,2)
      USING ROUND(COALESCE(stock_quantity, 0)::numeric, 2);
  END IF;
END $$;
