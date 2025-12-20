-- Criar tabela evolution_providers para gerenciar provedores Evolution por organização
CREATE TABLE IF NOT EXISTS public.evolution_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna para vincular organização ao provider
ALTER TABLE public.organization_limits 
  ADD COLUMN IF NOT EXISTS evolution_provider_id UUID REFERENCES public.evolution_providers(id);

-- Enable RLS
ALTER TABLE public.evolution_providers ENABLE ROW LEVEL SECURITY;

-- Policies - apenas super admins podem gerenciar providers
CREATE POLICY "Super admins can manage evolution providers"
ON public.evolution_providers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
  OR public.is_pubdigital_user(auth.uid())
);

-- Trigger para updated_at
CREATE TRIGGER update_evolution_providers_updated_at
  BEFORE UPDATE ON public.evolution_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();