-- ============================================
-- FIX: Verificar e corrigir tabela broadcast_queue
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que função update_updated_at_column existe
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Criar tabela broadcast_queue se não existir
-- ============================================
CREATE TABLE IF NOT EXISTS public.broadcast_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  name TEXT,
  personalized_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Adicionar colunas faltantes se não existirem
-- ============================================
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personalized_message TEXT;

-- Garantir que organization_id é NOT NULL
DO $$
BEGIN
  -- Backfill organization_id de campaigns existentes
  UPDATE public.broadcast_queue bq
  SET organization_id = bc.organization_id
  FROM public.broadcast_campaigns bc
  WHERE bq.campaign_id = bc.id
    AND bq.organization_id IS NULL;
  
  -- Tornar NOT NULL após backfill
  BEGIN
    ALTER TABLE public.broadcast_queue
    ALTER COLUMN organization_id SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Já é NOT NULL, ignorar
    NULL;
  END;
END $$;

-- ============================================
-- 4. Índices
-- ============================================
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_campaign ON public.broadcast_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_org ON public.broadcast_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON public.broadcast_queue(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status_sent_at ON public.broadcast_queue(status, sent_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_scheduled ON public.broadcast_queue(scheduled_for) WHERE status = 'scheduled';

-- ============================================
-- 5. RLS POLICIES
-- ============================================
ALTER TABLE public.broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Policies para broadcast_queue
DROP POLICY IF EXISTS "Users can view queue from their org" ON public.broadcast_queue;
CREATE POLICY "Users can view queue from their org"
  ON public.broadcast_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = broadcast_queue.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert queue in their org" ON public.broadcast_queue;
CREATE POLICY "Users can insert queue in their org"
  ON public.broadcast_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = broadcast_queue.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update queue in their org" ON public.broadcast_queue;
CREATE POLICY "Users can update queue in their org"
  ON public.broadcast_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = broadcast_queue.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = broadcast_queue.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete queue in their org" ON public.broadcast_queue;
CREATE POLICY "Users can delete queue in their org"
  ON public.broadcast_queue FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = broadcast_queue.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- 6. Função para setar organization_id automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION public.set_broadcast_queue_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se organization_id não foi fornecido, buscar da campanha
  IF NEW.organization_id IS NULL AND NEW.campaign_id IS NOT NULL THEN
    SELECT bc.organization_id INTO NEW.organization_id
    FROM public.broadcast_campaigns bc
    WHERE bc.id = NEW.campaign_id;
    
    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Campaign % does not have an organization', NEW.campaign_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para setar organization_id automaticamente
DROP TRIGGER IF EXISTS set_broadcast_queue_org_before_insert ON public.broadcast_queue;
CREATE TRIGGER set_broadcast_queue_org_before_insert
  BEFORE INSERT ON public.broadcast_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_broadcast_queue_organization();

-- ============================================
-- 7. Adicionar tabela ao realtime (opcional)
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_queue;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- 8. Comentários explicativos
-- ============================================
COMMENT ON TABLE public.broadcast_queue IS 'Fila de contatos para envio em campanhas de broadcast';
COMMENT ON COLUMN public.broadcast_queue.personalized_message IS 'Mensagem personalizada para este contato específico';
COMMENT ON COLUMN public.broadcast_queue.instance_id IS 'Instância WhatsApp que será usada para enviar a mensagem';

-- ============================================
-- 9. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 10. Verificar resultado
-- ============================================
SELECT 
  'broadcast_queue' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue' 
      AND column_name = 'organization_id'
  ) THEN '✅ organization_id OK' ELSE '❌ organization_id faltando' END as organization_id
UNION ALL
SELECT 
  'broadcast_queue',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue' 
      AND column_name = 'personalized_message'
  ) THEN '✅ personalized_message OK' ELSE '❌ personalized_message faltando' END
UNION ALL
SELECT 
  'broadcast_queue',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'broadcast_queue' 
      AND column_name = 'instance_id'
  ) THEN '✅ instance_id OK' ELSE '❌ instance_id faltando' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

