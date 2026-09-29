-- Opções de exibição do PDF do orçamento (subtotais, acréscimos, assinatura)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS pdf_display_options jsonb NOT NULL DEFAULT '{
    "show_product_subtotals": true,
    "show_service_subtotals": true,
    "show_additions": true,
    "show_signature": false
  }'::jsonb;

COMMENT ON COLUMN public.budgets.pdf_display_options IS
  'Flags de exibição do PDF: show_product_subtotals, show_service_subtotals, show_additions, show_signature';
