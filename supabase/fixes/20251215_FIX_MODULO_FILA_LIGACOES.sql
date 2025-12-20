-- ============================================
-- FIX: Verificar e corrigir módulo Fila de Ligações
-- Execute no Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Garantir que funções auxiliares existem
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

-- Função para setar organization_id automaticamente
CREATE OR REPLACE FUNCTION public.set_call_queue_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se organization_id não foi fornecido, buscar do lead
  IF NEW.organization_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Função para auditoria (created_by, updated_by)
CREATE OR REPLACE FUNCTION public.update_call_queue_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.updated_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Função para setar organization_id no histórico
CREATE OR REPLACE FUNCTION public.set_call_queue_history_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se organization_id não foi fornecido, buscar do lead
  IF NEW.organization_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Criar/Verificar tabela call_queue
-- ============================================
CREATE TABLE IF NOT EXISTS public.call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas se não existirem
ALTER TABLE public.call_queue
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS call_notes TEXT,
  ADD COLUMN IF NOT EXISTS completed_by TEXT,
  ADD COLUMN IF NOT EXISTS completed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Garantir que updated_at existe e tem valor padrão
DO $$
BEGIN
  -- Se updated_at não existe, adicionar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.call_queue 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
  
  -- Atualizar valores NULL para now()
  UPDATE public.call_queue
  SET updated_at = now()
  WHERE updated_at IS NULL;
  
  -- Tornar NOT NULL se ainda não for
  BEGIN
    ALTER TABLE public.call_queue
    ALTER COLUMN updated_at SET NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Já é NOT NULL, ignorar
    NULL;
  END;
END $$;

-- Garantir que organization_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue' 
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_queue 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill organization_id de leads existentes
UPDATE public.call_queue cq
SET organization_id = l.organization_id
FROM public.leads l
WHERE cq.lead_id = l.id AND cq.organization_id IS NULL;

-- Índices para call_queue
CREATE INDEX IF NOT EXISTS idx_call_queue_lead_id ON public.call_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_org ON public.call_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_status ON public.call_queue(status);
CREATE INDEX IF NOT EXISTS idx_call_queue_scheduled ON public.call_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_call_queue_assigned_to_user_id ON public.call_queue(assigned_to_user_id);

-- Constraint único para evitar duplicatas ativas
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_queue_active_by_lead_org
ON public.call_queue (lead_id, organization_id)
WHERE status IN ('pending','rescheduled');

-- RLS para call_queue
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para call_queue
DROP POLICY IF EXISTS "Call queue: members can select" ON public.call_queue;
CREATE POLICY "Call queue: members can select"
ON public.call_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Call queue: members can insert" ON public.call_queue;
CREATE POLICY "Call queue: members can insert"
ON public.call_queue
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Call queue: members can update" ON public.call_queue;
CREATE POLICY "Call queue: members can update"
ON public.call_queue
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Call queue: members can delete" ON public.call_queue;
CREATE POLICY "Call queue: members can delete"
ON public.call_queue
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Triggers para call_queue
DROP TRIGGER IF EXISTS trg_call_queue_set_org ON public.call_queue;
CREATE TRIGGER trg_call_queue_set_org
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_organization();

DROP TRIGGER IF EXISTS trg_call_queue_audit ON public.call_queue;
CREATE TRIGGER trg_call_queue_audit
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_audit();

DROP TRIGGER IF EXISTS trg_call_queue_update_updated_at ON public.call_queue;
CREATE TRIGGER trg_call_queue_update_updated_at
BEFORE UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. Criar/Verificar tabela call_queue_history
-- ============================================
CREATE TABLE IF NOT EXISTS public.call_queue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  completed_by_user_id UUID,
  status TEXT NOT NULL,
  priority TEXT,
  notes TEXT,
  call_notes TEXT,
  call_count INTEGER DEFAULT 0,
  action TEXT NOT NULL, -- 'completed', 'deleted', 'rescheduled'
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Garantir que organization_id existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue_history' 
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.call_queue_history 
    ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Backfill organization_id de leads existentes
UPDATE public.call_queue_history cqh
SET organization_id = l.organization_id
FROM public.leads l
WHERE cqh.lead_id = l.id AND cqh.organization_id IS NULL;

-- Índices para call_queue_history
CREATE INDEX IF NOT EXISTS idx_call_queue_history_user_id ON public.call_queue_history(user_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_history_created_at ON public.call_queue_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_queue_history_org ON public.call_queue_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_history_lead_id ON public.call_queue_history(lead_id);

-- RLS para call_queue_history
ALTER TABLE public.call_queue_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para call_queue_history
DROP POLICY IF EXISTS "CQ history: members can select" ON public.call_queue_history;
CREATE POLICY "CQ history: members can select"
ON public.call_queue_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "CQ history: members can insert" ON public.call_queue_history;
CREATE POLICY "CQ history: members can insert"
ON public.call_queue_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "CQ history: members can delete" ON public.call_queue_history;
CREATE POLICY "CQ history: members can delete"
ON public.call_queue_history
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR auth.uid() = user_id
);

-- Triggers para call_queue_history
DROP TRIGGER IF EXISTS trg_cq_hist_set_org ON public.call_queue_history;
CREATE TRIGGER trg_cq_hist_set_org
BEFORE INSERT OR UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_history_organization();

-- ============================================
-- 4. Criar/Verificar tabela call_queue_tags
-- ============================================
CREATE TABLE IF NOT EXISTS public.call_queue_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_queue_id UUID NOT NULL REFERENCES public.call_queue(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(call_queue_id, tag_id)
);

-- RLS para call_queue_tags
ALTER TABLE public.call_queue_tags ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para call_queue_tags
DROP POLICY IF EXISTS "Users can view tags on their call queue items" ON public.call_queue_tags;
CREATE POLICY "Users can view tags on their call queue items"
ON public.call_queue_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM public.call_queue cq
    JOIN public.organization_members om ON om.organization_id = cq.organization_id
    WHERE cq.id = call_queue_tags.call_queue_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can add tags to their call queue items" ON public.call_queue_tags;
CREATE POLICY "Users can add tags to their call queue items"
ON public.call_queue_tags
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.call_queue cq
    JOIN public.organization_members om ON om.organization_id = cq.organization_id
    WHERE cq.id = call_queue_tags.call_queue_id
      AND om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can remove tags from their call queue items" ON public.call_queue_tags;
CREATE POLICY "Users can remove tags from their call queue items"
ON public.call_queue_tags
FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.call_queue cq
    JOIN public.organization_members om ON om.organization_id = cq.organization_id
    WHERE cq.id = call_queue_tags.call_queue_id
      AND om.user_id = auth.uid()
  )
);

-- Índices para call_queue_tags
CREATE INDEX IF NOT EXISTS idx_call_queue_tags_call_queue ON public.call_queue_tags(call_queue_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_tags_tag ON public.call_queue_tags(tag_id);

-- ============================================
-- 5. Forçar refresh do cache PostgREST
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- 6. Verificar resultado
-- ============================================
SELECT 
  'call_queue' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue' 
      AND column_name = 'organization_id'
  ) THEN '✅ organization_id OK' ELSE '❌ organization_id faltando' END as organization_id
UNION ALL
SELECT 
  'call_queue_history',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue_history'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue_history' 
      AND column_name = 'organization_id'
  ) THEN '✅ organization_id OK' ELSE '❌ organization_id faltando' END
UNION ALL
SELECT 
  'call_queue_tags',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'call_queue_tags'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END,
  '✅ OK';

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

