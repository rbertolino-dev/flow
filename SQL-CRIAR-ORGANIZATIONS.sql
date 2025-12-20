-- ============================================
-- SQL PARA CRIAR TABELAS DE ORGANIZATIONS
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Criar tabela de organizações
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Criar tabela de membros de organizações
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Função para obter a organização do usuário
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = _user_id 
  LIMIT 1;
$$;

-- Função para verificar se usuário pertence à organização
CREATE OR REPLACE FUNCTION public.user_belongs_to_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_members 
    WHERE user_id = _user_id 
    AND organization_id = _org_id
  );
$$;

-- Policies básicas
CREATE POLICY "Users can view their organization"
ON public.organizations FOR SELECT
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update"
ON public.organizations FOR UPDATE
USING (
  id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
  )
);

CREATE POLICY "Users can view members of their organization"
ON public.organization_members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners and admins can manage members"
ON public.organization_members FOR ALL
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
