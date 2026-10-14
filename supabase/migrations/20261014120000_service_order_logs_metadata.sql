-- Metadados estruturados em logs da OS (ex.: mudança de etapa from/to)

ALTER TABLE public.service_order_logs
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_so_logs_org_event_created
  ON public.service_order_logs (organization_id, event_type, created_at DESC);
