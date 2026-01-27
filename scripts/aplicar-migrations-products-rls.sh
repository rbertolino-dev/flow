#!/bin/bash

# ============================================
# Aplicar Migrations: RLS de Produtos
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

MIGRATION1="$PROJECT_DIR/supabase/migrations/20260126000001_add_public_products_rls_for_landing_pages.sql"
MIGRATION2="$PROJECT_DIR/supabase/migrations/20260126000002_fix_products_rls_for_foreign_keys.sql"

echo "🚀 Aplicando migrations: RLS de Produtos"
echo ""
echo "📄 Migration 1: RLS Público para Landing Pages"
echo "📄 Migration 2: Correção de Foreign Keys"
echo ""

# Combinar ambas migrations em uma única
COMBINED_SQL=$(cat << 'EOF'
-- =====================================================
-- Migration Combinada: RLS de Produtos Completo
-- Data: 2026-01-26
-- Descrição: 
--   1. Permite leitura pública de produtos para landing pages ativas
--   2. Corrige verificação de foreign keys ao adicionar produtos à landing page
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view products of their organization" ON public.products;
DROP POLICY IF EXISTS "Public can view products for active landing pages" ON public.products;

-- Política única consolidada: Usuários autenticados + Público para landing pages
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

-- Garantir que outras políticas existam
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

COMMENT ON POLICY "Users can view products of their organization" ON public.products IS 
'Permite que usuários autenticados vejam produtos da sua organização (necessário para verificação de foreign keys) e visitantes vejam produtos quando há landing page ativa.';
EOF
)

echo "📝 SQL para aplicar manualmente no Supabase Dashboard:"
echo ""
echo "=========================================="
echo "$COMBINED_SQL"
echo "=========================================="
echo ""
echo "📋 INSTRUÇÕES:"
echo ""
echo "1. Acesse: https://supabase.com/dashboard"
echo "2. Selecione seu projeto"
echo "3. Vá em 'SQL Editor' (menu lateral)"
echo "4. Cole o SQL acima e clique em 'Run'"
echo ""
echo "✅ Após aplicar:"
echo "   - Produtos aparecerão na landing page pública"
echo "   - Você poderá adicionar produtos manualmente à landing page"
echo ""
