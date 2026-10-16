-- Medida fragmentada: estoque na unidade padrão; venda opcional na unidade fracionada.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fragment_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fragment_unit TEXT,
  ADD COLUMN IF NOT EXISTS fragment_qty NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS fragment_price NUMERIC(12, 2);

COMMENT ON COLUMN public.products.fragment_enabled IS 'Se true, PDV pode vender na unidade fragmentada além da unidade padrão';
COMMENT ON COLUMN public.products.fragment_unit IS 'Unidade fragmentada (ex.: un, cm)';
COMMENT ON COLUMN public.products.fragment_qty IS 'Quantidade de fragmentos em 1 unidade padrão (ex.: 12 un por caixa)';
COMMENT ON COLUMN public.products.fragment_price IS 'Preço de venda por unidade fragmentada';
