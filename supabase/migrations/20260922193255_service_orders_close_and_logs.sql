-- Encerramento de Ordem de Serviço: execução, anexos, assinatura e logs

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS closed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS execution_summary TEXT,
  ADD COLUMN IF NOT EXISTS execution_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS close_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS signature_url TEXT,
  ADD COLUMN IF NOT EXISTS creator_name TEXT;

CREATE INDEX IF NOT EXISTS idx_service_orders_closed
  ON public.service_orders (organization_id, is_closed)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.service_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'note',
  message TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_logs_order
  ON public.service_order_logs (service_order_id, created_at DESC);

ALTER TABLE public.service_order_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_logs_select ON public.service_order_logs;
DROP POLICY IF EXISTS service_order_logs_insert ON public.service_order_logs;
DROP POLICY IF EXISTS service_order_logs_update ON public.service_order_logs;
DROP POLICY IF EXISTS service_order_logs_delete ON public.service_order_logs;

CREATE POLICY service_order_logs_select ON public.service_order_logs FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY service_order_logs_insert ON public.service_order_logs FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY service_order_logs_update ON public.service_order_logs FOR UPDATE USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);
CREATE POLICY service_order_logs_delete ON public.service_order_logs FOR DELETE USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

GRANT ALL ON public.service_order_logs TO authenticated;
