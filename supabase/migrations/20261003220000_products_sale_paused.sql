-- Produto com venda pausada continua no estoque, mas some das listas de venda.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_paused boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.sale_paused IS
  'Quando true, o produto permanece visível no estoque e deixa de aparecer na Venda Rápida, no orçamento e na ordem de serviço.';
