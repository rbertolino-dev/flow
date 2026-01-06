-- =====================================================
-- FIX: Corrigir políticas RLS de evolution_logs
-- =====================================================
-- Problema: Políticas RLS só permitem ver logs do próprio user_id
-- Solução: Permitir que usuários vejam logs da própria organização

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS public.evolution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance TEXT,
  event TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.evolution_logs ENABLE ROW LEVEL SECURITY;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_evolution_logs_user_created ON public.evolution_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_event ON public.evolution_logs (event);
CREATE INDEX IF NOT EXISTS idx_evolution_logs_organization ON public.evolution_logs(organization_id);

-- Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Users can view their own evolution logs" ON public.evolution_logs;
DROP POLICY IF EXISTS "Users can insert their own evolution logs" ON public.evolution_logs;
DROP POLICY IF EXISTS "Users can view evolution logs from their organization" ON public.evolution_logs;
DROP POLICY IF EXISTS "Users can insert evolution logs" ON public.evolution_logs;

-- Adicionar coluna organization_id se tabela já existir mas não tiver a coluna
DO $$ 
BEGIN
  -- Verificar se tabela existe mas não tem organization_id
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'evolution_logs' 
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.evolution_logs 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
    
    -- Criar índice
    CREATE INDEX IF NOT EXISTS idx_evolution_logs_organization 
    ON public.evolution_logs(organization_id);
  END IF;
END $$;

-- Política para SELECT: Usuários podem ver logs da própria organização
CREATE POLICY "Users can view evolution logs from their organization"
  ON public.evolution_logs FOR SELECT
  USING (
    -- Se tem organization_id, verificar se usuário pertence à organização
    (
      organization_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = evolution_logs.organization_id
          AND om.user_id = auth.uid()
      )
    )
    -- Se não tem organization_id mas tem user_id, permitir se for o próprio usuário
    OR (
      organization_id IS NULL 
      AND user_id IS NOT NULL 
      AND auth.uid() = user_id
    )
    -- Super admins podem ver tudo
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Política para INSERT: Permitir inserção via service role (webhook) ou usuário da organização
CREATE POLICY "Users can insert evolution logs"
  ON public.evolution_logs FOR INSERT
  WITH CHECK (
    -- Se tem organization_id, verificar se usuário pertence à organização
    (
      organization_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = evolution_logs.organization_id
          AND om.user_id = auth.uid()
      )
    )
    -- Se não tem organization_id mas tem user_id, permitir se for o próprio usuário
    OR (
      organization_id IS NULL 
      AND user_id IS NOT NULL 
      AND auth.uid() = user_id
    )
    -- Service role pode inserir (webhook)
    OR current_setting('role') = 'service_role'
  );

-- Comentário
COMMENT ON TABLE public.evolution_logs IS 'Logs de eventos da Evolution API. Políticas RLS permitem acesso por organização.';

