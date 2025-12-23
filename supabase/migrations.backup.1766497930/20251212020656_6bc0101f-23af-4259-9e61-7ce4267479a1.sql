
-- Criar tabela organization_onboarding_progress
CREATE TABLE public.organization_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  step_completed TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, step_completed)
);

-- Enable RLS
ALTER TABLE public.organization_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies for organization_onboarding_progress
DROP POLICY IF EXISTS "Users can view their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can view their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can view their org onboarding" ON public.organization_onboarding_progress
FOR SELECT USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can insert their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can insert their org onboarding" ON public.organization_onboarding_progress
FOR INSERT WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

DROP POLICY IF EXISTS "Users can update their org onboarding" ON public.organization_onboarding_progress;
CREATE POLICY "Users can update their org onboarding" ON public.organization_onboarding_progress
CREATE POLICY "Users can update their org onboarding" ON public.organization_onboarding_progress
FOR UPDATE USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));
