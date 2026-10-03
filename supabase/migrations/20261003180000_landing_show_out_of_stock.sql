ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS show_out_of_stock boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.landing_pages.show_out_of_stock IS
  'Quando verdadeiro, produtos sem saldo aparecem na vitrine como esgotados.';
