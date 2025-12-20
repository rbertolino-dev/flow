-- ============================================
-- FIX: Adicionar stage_id em leads (erro ao criar lead)
-- Execute no Supabase SQL Editor
-- ============================================

-- Adicionar coluna stage_id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'stage_id'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage_id);
  END IF;
END $$;

-- Opcional: garantir que coluna deleted_at existe (para compatibilidade com create_lead_secure)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.leads 
      ADD COLUMN deleted_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at);
  END IF;
END $$;

-- ============================================
-- FIM DO SCRIPT
-- Após executar, recarregue o app e teste criar um lead
-- ============================================

