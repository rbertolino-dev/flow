-- Migration: Remover tabela products do Supabase
-- Data: 2025-01-25
-- Descrição: Remove tabela products do Supabase após migração para PostgreSQL
-- IMPORTANTE: Executar apenas após validação completa da migração

-- Remover foreign key de leads.product_id (manter coluna como UUID simples)
ALTER TABLE IF EXISTS public.leads 
  DROP CONSTRAINT IF EXISTS leads_product_id_fkey;

-- Remover índice de product_id (se existir)
DROP INDEX IF EXISTS public.idx_leads_product;

-- Remover políticas RLS da tabela products
DROP POLICY IF EXISTS "Users can view products in their org" ON public.products;
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Users can insert products in their org" ON public.products;
DROP POLICY IF EXISTS "Users can create products for their organization" ON public.products;
DROP POLICY IF EXISTS "Users can update products in their org" ON public.products;
DROP POLICY IF EXISTS "Users can update products of their organization" ON public.products;
DROP POLICY IF EXISTS "Users can delete products in their org" ON public.products;
DROP POLICY IF EXISTS "Users can delete products of their organization" ON public.products;

-- Remover triggers
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

-- Remover função de trigger (se não for usada por outras tabelas)
-- DROP FUNCTION IF EXISTS public.update_updated_at_column(); -- Não remover, pode ser usada por outras tabelas

-- Remover índices
DROP INDEX IF EXISTS public.idx_products_org;
DROP INDEX IF EXISTS public.idx_products_organization;
DROP INDEX IF EXISTS public.idx_products_category;
DROP INDEX IF EXISTS public.idx_products_active;

-- Remover tabela products do Supabase
-- ATENÇÃO: Esta operação é irreversível!
-- Descomente apenas após validação completa:
-- DROP TABLE IF EXISTS public.products CASCADE;

-- Comentário: A coluna product_id em leads foi mantida como UUID simples (sem foreign key)
-- Para buscar produtos, usar Edge Function /functions/v1/products/:id
-- Validar que produto pertence à mesma organização do lead antes de usar

