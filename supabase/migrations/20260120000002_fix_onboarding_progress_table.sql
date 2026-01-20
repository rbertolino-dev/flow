-- ============================================
-- FIX: Garantir que organization_onboarding_progress está correta
-- ============================================

-- 1. Criar tabela se não existir
CREATE TABLE IF NOT EXISTS public.organization_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_completed TEXT NOT NULL, -- 'organization', 'users', 'pipeline', 'products', 'evolution'
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, step_completed)
);

-- 2. Adicionar coluna user_id se não existir (opcional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_onboarding_progress'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.organization_onboarding_progress
    ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Corrigir foreign key de user_id se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_onboarding_progress'
      AND column_name = 'user_id'
  ) THEN
    -- Remover constraint antiga se existir
    ALTER TABLE public.organization_onboarding_progress
    DROP CONSTRAINT IF EXISTS organization_onboarding_progress_user_id_fkey;
    
    -- Adicionar constraint que referencia auth.users
    ALTER TABLE public.organization_onboarding_progress
    ADD CONSTRAINT organization_onboarding_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org ON public.organization_onboarding_progress(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_step ON public.organization_onboarding_progress(step_completed);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON public.organization_onboarding_progress(user_id) WHERE user_id IS NOT NULL;

-- 5. Habilitar RLS
ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- 6. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view onboarding progress of their organization" ON public.organization_onboarding_progress;
DROP POLICY IF EXISTS "Users can insert onboarding progress for their organization" ON public.organization_onboarding_progress;
DROP POLICY IF EXISTS "Users can update onboarding progress of their organization" ON public.organization_onboarding_progress;

-- 7. Criar políticas RLS corretas
CREATE POLICY "Users can view onboarding progress of their organization"
ON public.organization_onboarding_progress FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_onboarding_progress.organization_id
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can insert onboarding progress for their organization"
ON public.organization_onboarding_progress FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_onboarding_progress.organization_id
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update onboarding progress of their organization"
ON public.organization_onboarding_progress FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_onboarding_progress.organization_id
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = organization_onboarding_progress.organization_id
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- 8. Comentários para documentação
COMMENT ON TABLE public.organization_onboarding_progress IS 'Rastreia o progresso do onboarding por organização';
COMMENT ON COLUMN public.organization_onboarding_progress.user_id IS 'ID do usuário que completou a etapa (opcional)';
COMMENT ON COLUMN public.organization_onboarding_progress.step_completed IS 'Etapa completada: organization, users, pipeline, products, evolution';
