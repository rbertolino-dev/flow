#!/bin/bash

# Script para aplicar migrations de múltiplos Evolution Providers via SQL direto
# Usa Supabase Management API ou executa SQL diretamente

set -e

PROJECT_DIR="/root/kanban-buzz-95241"
cd "$PROJECT_DIR"

echo "🔄 Aplicando migrations para múltiplos Evolution Providers via SQL..."

# Ler credenciais
if [ -f "CREDENCIAIS-RAPIDAS.md" ]; then
    source <(grep -E "^export " CREDENCIAIS-RAPIDAS.md 2>/dev/null || true)
fi

# Combinar migrations em um único arquivo SQL
SQL_FILE="/tmp/migration_multiplos_providers.sql"

cat > "$SQL_FILE" << 'EOF'
-- ============================================
-- Migration: Suporte a múltiplos Evolution Providers por organização
-- ============================================

-- 1. Criar tabela de relacionamento many-to-many
CREATE TABLE IF NOT EXISTS public.organization_evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evolution_provider_id UUID NOT NULL REFERENCES public.evolution_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Evitar duplicatas: uma organização não pode ter o mesmo provider duas vezes
  UNIQUE(organization_id, evolution_provider_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_evolution_providers_org ON public.organization_evolution_providers(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_evolution_providers_provider ON public.organization_evolution_providers(evolution_provider_id);

-- Habilitar RLS
ALTER TABLE public.organization_evolution_providers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para super admins
DROP POLICY IF EXISTS "Super admins can view all organization evolution providers" ON public.organization_evolution_providers;
CREATE POLICY "Super admins can view all organization evolution providers"
  ON public.organization_evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Super admins can manage all organization evolution providers" ON public.organization_evolution_providers;
CREATE POLICY "Super admins can manage all organization evolution providers"
  ON public.organization_evolution_providers
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Políticas RLS para org owners
DROP POLICY IF EXISTS "Org owners can view their organization evolution providers" ON public.organization_evolution_providers;
CREATE POLICY "Org owners can view their organization evolution providers"
  ON public.organization_evolution_providers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organization_evolution_providers.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_organization_evolution_providers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_organization_evolution_providers_updated_at ON public.organization_evolution_providers;
CREATE TRIGGER trg_update_organization_evolution_providers_updated_at
BEFORE UPDATE ON public.organization_evolution_providers
FOR EACH ROW
EXECUTE FUNCTION public.update_organization_evolution_providers_updated_at();

-- Migrar dados existentes de organization_limits.evolution_provider_id para a nova tabela
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Para cada organização que tem evolution_provider_id em organization_limits
  FOR rec IN 
    SELECT organization_id, evolution_provider_id
    FROM public.organization_limits
    WHERE evolution_provider_id IS NOT NULL
  LOOP
    -- Inserir na nova tabela se não existir
    INSERT INTO public.organization_evolution_providers (organization_id, evolution_provider_id)
    VALUES (rec.organization_id, rec.evolution_provider_id)
    ON CONFLICT (organization_id, evolution_provider_id) DO NOTHING;
  END LOOP;
END $$;

-- 2. Atualizar função para retornar múltiplos providers
CREATE OR REPLACE FUNCTION public.get_organization_evolution_provider(_org_id UUID)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  api_url TEXT,
  api_key TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN;
  END IF;
  
  -- Buscar providers da nova tabela organization_evolution_providers (múltiplos)
  RETURN QUERY
  SELECT 
    ep.id as provider_id,
    ep.name as provider_name,
    ep.api_url,
    ep.api_key
  FROM public.organization_evolution_providers oep
  INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
  WHERE oep.organization_id = _org_id
    AND ep.is_active = true
  ORDER BY ep.name;
  
  -- Se não encontrou na nova tabela, tentar buscar da estrutura antiga (organization_limits)
  -- para manter compatibilidade durante migração
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ep.id as provider_id,
      ep.name as provider_name,
      ep.api_url,
      ep.api_key
    FROM public.organization_limits ol
    INNER JOIN public.evolution_providers ep ON ep.id = ol.evolution_provider_id
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
      AND ep.is_active = true;
  END IF;
  
  -- Se não encontrou nada, retorna vazio (não gera erro)
  RETURN;
END;
$$;

-- Atualizar função de verificação
CREATE OR REPLACE FUNCTION public.organization_has_evolution_provider(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verificar se o usuário pertence à organização
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = _org_id
      AND om.user_id = v_user_id
  ) THEN
    RETURN false;
  END IF;
  
  -- Verificar na nova tabela
  IF EXISTS (
    SELECT 1
    FROM public.organization_evolution_providers oep
    INNER JOIN public.evolution_providers ep ON ep.id = oep.evolution_provider_id
    WHERE oep.organization_id = _org_id
      AND ep.is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Fallback para estrutura antiga
  IF EXISTS (
    SELECT 1
    FROM public.organization_limits ol
    WHERE ol.organization_id = _org_id
      AND ol.evolution_provider_id IS NOT NULL
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Comentários
COMMENT ON TABLE public.organization_evolution_providers IS 'Relacionamento many-to-many entre organizações e providers Evolution - permite múltiplos providers por organização';
COMMENT ON FUNCTION public.get_organization_evolution_provider IS 'Retorna todos os providers Evolution configurados para uma organização (múltiplos providers suportados)';
COMMENT ON FUNCTION public.organization_has_evolution_provider IS 'Verifica se uma organização tem pelo menos um provider Evolution configurado';
EOF

echo "✅ SQL gerado em: $SQL_FILE"
echo ""
echo "📋 Para aplicar:"
echo "   1. Acesse o Supabase Dashboard > SQL Editor"
echo "   2. Cole o conteúdo do arquivo: $SQL_FILE"
echo "   3. Execute"
echo ""
echo "Ou execute via script de aplicar SQL SSH:"
echo "   ./scripts/executar-sql-ssh.sh $SQL_FILE"

