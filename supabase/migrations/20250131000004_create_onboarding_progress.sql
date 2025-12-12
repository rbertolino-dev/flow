-- ============================================
-- MIGRAÇÃO: Criar tabela de progresso do onboarding
-- ============================================

-- Criar tabela de progresso do onboarding
CREATE TABLE IF NOT EXISTS public.organization_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_completed TEXT NOT NULL, -- 'organization', 'users', 'pipeline', 'products', 'evolution'
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, step_completed)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org ON public.organization_onboarding_progress(organization_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_step ON public.organization_onboarding_progress(step_completed);

-- Habilitar RLS
ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view onboarding progress of their organization"
ON public.organization_onboarding_progress FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert onboarding progress for their organization"
ON public.organization_onboarding_progress FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update onboarding progress of their organization"
ON public.organization_onboarding_progress FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Comentários para documentação
COMMENT ON TABLE public.organization_onboarding_progress IS 'Rastreia o progresso do onboarding por organização';
COMMENT ON COLUMN public.organization_onboarding_progress.step_completed IS 'Etapa completada: organization, users, pipeline, products, evolution';

