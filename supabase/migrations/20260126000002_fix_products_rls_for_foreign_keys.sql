-- Migration: Corrigir RLS de produtos para permitir verificação de foreign keys
-- Data: 2026-01-26
-- Descrição: Ajusta políticas RLS de produtos para permitir que usuários autenticados
--            vejam produtos da sua organização (necessário para verificação de foreign keys)

-- =====================================================
-- PROBLEMA: Foreign key constraint falha ao inserir em landing_page_items
-- =====================================================
-- Quando um usuário autenticado tenta inserir um produto em landing_page_items,
-- o PostgreSQL precisa verificar se o product_id existe na tabela products.
-- Mas a RLS pode estar bloqueando essa verificação se o usuário não conseguir
-- ver o produto mesmo sendo da mesma organização.

-- =====================================================
-- SOLUÇÃO: Ajustar política RLS de produtos
-- =====================================================
-- Garantir que usuários autenticados possam ver produtos da sua organização
-- para permitir verificação de foreign keys

-- Remover política antiga se existir (pode ter nomes diferentes)
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;

-- Política 1: Usuários autenticados podem ver produtos da sua organização
-- Esta política permite que usuários autenticados vejam produtos para:
-- - Verificação de foreign keys ao inserir em landing_page_items
-- - Gerenciamento de produtos no painel admin
CREATE POLICY "Users can view products of their organization"
ON public.products FOR SELECT
USING (
  -- Usuário autenticado e produto pertence à organização do usuário
  (
    auth.uid() IS NOT NULL
    AND organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
  OR
  -- Super admin ou pubdigital user
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
  OR
  -- Leitura pública quando há landing page ativa (para visitantes não autenticados)
  (
    is_active = true
    AND EXISTS (
      SELECT 1 
      FROM public.landing_pages lp
      WHERE lp.organization_id = products.organization_id
        AND lp.is_active = true
    )
  )
);

-- Política 2: Usuários autenticados podem criar produtos na sua organização
DROP POLICY IF EXISTS "Users can create products for their organization" ON public.products;
CREATE POLICY "Users can create products for their organization"
ON public.products FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Política 3: Usuários autenticados podem atualizar produtos da sua organização
DROP POLICY IF EXISTS "Users can update products of their organization" ON public.products;
CREATE POLICY "Users can update products of their organization"
ON public.products FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Política 4: Usuários autenticados podem deletar produtos da sua organização
DROP POLICY IF EXISTS "Users can delete products of their organization" ON public.products;
CREATE POLICY "Users can delete products of their organization"
ON public.products FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Comentários explicativos
COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização (necessário para verificação de foreign keys) e visitantes vejam produtos quando há landing page ativa.';
