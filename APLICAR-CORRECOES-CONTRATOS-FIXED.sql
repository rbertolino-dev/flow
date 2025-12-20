-- ============================================
-- CORREÇÕES PARA MÓDULO DE CONTRATOS (VERSÃO CORRIGIDA)
-- Aplicar este SQL no Supabase SQL Editor
-- ============================================

-- 1. CORRIGIR POLÍTICAS RLS PARA INCLUIR PUBDIGITAL
-- ============================================

-- Remover políticas antigas de contracts
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_templates
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. CORRIGIR TIPOS DE REMINDER_TYPE (se tabela já existe)
-- ============================================

-- Remover constraint antigo se existir
ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_reminder_type_check;

-- Adicionar novo constraint com todos os tipos
ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_reminder_type_check 
CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder'));

-- Corrigir sent_via também
ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_sent_via_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_sent_via_check 
CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both'));

-- 3. VERIFICAR SE AS TABELAS EXISTEM E CRIAR SE NECESSÁRIO
-- ============================================

-- Verificar e criar contract_categories se não existir
CREATE TABLE IF NOT EXISTS public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Adicionar category_id em contracts se não existir
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.contract_categories(id) ON DELETE SET NULL;

-- Habilitar RLS em contract_categories
ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contract_categories
DROP POLICY IF EXISTS "Users can view categories from their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can create categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can update categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.contract_categories;

CREATE POLICY "Users can view categories from their organization"
ON public.contract_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create categories in their organization"
ON public.contract_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update categories in their organization"
ON public.contract_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete categories"
ON public.contract_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contract_categories_org ON public.contract_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_categories_active ON public.contract_categories(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_category ON public.contracts(category_id) WHERE category_id IS NOT NULL;

-- 5. VERIFICAR E CRIAR FUNÇÕES NECESSÁRIAS (SEM DO $$)
-- ============================================

-- Criar função is_pubdigital_user se não existir
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário pertence à organização pubdigital
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = user_id
      AND LOWER(o.name) = 'pubdigital'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função has_role se não existir
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_id
      AND ur.role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIM DAS CORREÇÕES
-- ============================================


-- CORREÇÕES PARA MÓDULO DE CONTRATOS (VERSÃO CORRIGIDA)
-- Aplicar este SQL no Supabase SQL Editor
-- ============================================

-- 1. CORRIGIR POLÍTICAS RLS PARA INCLUIR PUBDIGITAL
-- ============================================

-- Remover políticas antigas de contracts
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_templates
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. CORRIGIR TIPOS DE REMINDER_TYPE (se tabela já existe)
-- ============================================

-- Remover constraint antigo se existir
ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_reminder_type_check;

-- Adicionar novo constraint com todos os tipos
ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_reminder_type_check 
CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder'));

-- Corrigir sent_via também
ALTER TABLE public.contract_reminders 
DROP CONSTRAINT IF EXISTS contract_reminders_sent_via_check;

ALTER TABLE public.contract_reminders 
ADD CONSTRAINT contract_reminders_sent_via_check 
CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both'));

-- 3. VERIFICAR SE AS TABELAS EXISTEM E CRIAR SE NECESSÁRIO
-- ============================================

-- Verificar e criar contract_categories se não existir
CREATE TABLE IF NOT EXISTS public.contract_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Adicionar category_id em contracts se não existir
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.contract_categories(id) ON DELETE SET NULL;

-- Habilitar RLS em contract_categories
ALTER TABLE public.contract_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contract_categories
DROP POLICY IF EXISTS "Users can view categories from their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can create categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Users can update categories in their organization" ON public.contract_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.contract_categories;

CREATE POLICY "Users can view categories from their organization"
ON public.contract_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create categories in their organization"
ON public.contract_categories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update categories in their organization"
ON public.contract_categories FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete categories"
ON public.contract_categories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_categories.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_contract_categories_org ON public.contract_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_contract_categories_active ON public.contract_categories(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_category ON public.contracts(category_id) WHERE category_id IS NOT NULL;

-- 5. VERIFICAR E CRIAR FUNÇÕES NECESSÁRIAS (SEM DO $$)
-- ============================================

-- Criar função is_pubdigital_user se não existir
CREATE OR REPLACE FUNCTION public.is_pubdigital_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se o usuário pertence à organização pubdigital
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members om
    INNER JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = user_id
      AND LOWER(o.name) = 'pubdigital'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função has_role se não existir
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role_name app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_id
      AND ur.role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIM DAS CORREÇÕES
-- ============================================













