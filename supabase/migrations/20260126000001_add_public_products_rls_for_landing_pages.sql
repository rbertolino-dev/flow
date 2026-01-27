-- Migration: Permitir leitura pública de produtos para landing pages ativas
-- Data: 2026-01-26
-- Descrição: Adiciona política RLS que permite visitantes não autenticados verem produtos
--            quando a organização tem uma landing page ativa

-- =====================================================
-- POLÍTICA RLS: Permitir leitura pública de produtos
-- =====================================================
-- Esta política permite que visitantes não autenticados vejam produtos
-- quando a organização tem pelo menos uma landing page ativa
-- Apenas produtos ativos (is_active = true) são visíveis publicamente

DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;

CREATE POLICY "Public can view products for active landing pages"
ON public.products FOR SELECT
USING (
  -- Apenas produtos ativos
  is_active = true
  AND
  -- A organização deve ter pelo menos uma landing page ativa
  EXISTS (
    SELECT 1 
    FROM public.landing_pages lp
    WHERE lp.organization_id = products.organization_id
      AND lp.is_active = true
  )
);

-- Comentário explicativo
COMMENT ON POLICY "Public can view products for active landing pages" ON public.products IS 
'Permite leitura pública de produtos ativos quando a organização tem uma landing page ativa. Esta política é necessária para que visitantes não autenticados possam ver produtos na landing page pública.';
