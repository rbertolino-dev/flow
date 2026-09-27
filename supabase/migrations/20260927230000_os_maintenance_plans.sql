-- Plano de manutenção: várias visitas criadas de uma vez, ligadas à mesma OS.

CREATE TABLE IF NOT EXISTS public.service_order_maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.service_order_templates(id) ON DELETE SET NULL,
  interval_unit TEXT NOT NULL CHECK (interval_unit IN ('day', 'week', 'month')),
  interval_count INTEGER NOT NULL CHECK (interval_count > 0),
  occurrence_total INTEGER NOT NULL CHECK (occurrence_total BETWEEN 2 AND 24),
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_maintenance_plans_org
  ON public.service_order_maintenance_plans (organization_id, created_at DESC);

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS maintenance_plan_id UUID REFERENCES public.service_order_maintenance_plans(id) ON DELETE SET NULL;

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS maintenance_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_service_orders_maintenance_plan
  ON public.service_orders (organization_id, maintenance_plan_id, maintenance_index)
  WHERE deleted_at IS NULL AND maintenance_plan_id IS NOT NULL;

ALTER TABLE public.service_order_maintenance_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_maintenance_plans_select ON public.service_order_maintenance_plans;
DROP POLICY IF EXISTS service_order_maintenance_plans_insert ON public.service_order_maintenance_plans;
DROP POLICY IF EXISTS service_order_maintenance_plans_update ON public.service_order_maintenance_plans;
DROP POLICY IF EXISTS service_order_maintenance_plans_delete ON public.service_order_maintenance_plans;

CREATE POLICY service_order_maintenance_plans_select ON public.service_order_maintenance_plans
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_maintenance_plans_insert ON public.service_order_maintenance_plans
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_maintenance_plans_update ON public.service_order_maintenance_plans
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_maintenance_plans_delete ON public.service_order_maintenance_plans
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON public.service_order_maintenance_plans TO authenticated;
