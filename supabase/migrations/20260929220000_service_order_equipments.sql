-- Equipamentos por cliente + vínculo N:N com ordens de serviço

CREATE TABLE IF NOT EXISTS public.equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT,
  equipment_type TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  sector TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_equipments_org_lead
  ON public.equipments (organization_id, lead_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipments_org_status
  ON public.equipments (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipments_serial
  ON public.equipments (organization_id, serial_number)
  WHERE deleted_at IS NULL AND serial_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipments_brand_model
  ON public.equipments (organization_id, brand, model)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.service_order_equipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_order_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_so_equipments_order
  ON public.service_order_equipments (service_order_id);

CREATE INDEX IF NOT EXISTS idx_so_equipments_equipment
  ON public.service_order_equipments (organization_id, equipment_id);

CREATE INDEX IF NOT EXISTS idx_so_equipments_org
  ON public.service_order_equipments (organization_id);

ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_equipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipments_select ON public.equipments;
DROP POLICY IF EXISTS equipments_insert ON public.equipments;
DROP POLICY IF EXISTS equipments_update ON public.equipments;
DROP POLICY IF EXISTS equipments_delete ON public.equipments;

CREATE POLICY equipments_select ON public.equipments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY equipments_insert ON public.equipments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY equipments_update ON public.equipments
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY equipments_delete ON public.equipments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS service_order_equipments_select ON public.service_order_equipments;
DROP POLICY IF EXISTS service_order_equipments_insert ON public.service_order_equipments;
DROP POLICY IF EXISTS service_order_equipments_update ON public.service_order_equipments;
DROP POLICY IF EXISTS service_order_equipments_delete ON public.service_order_equipments;

CREATE POLICY service_order_equipments_select ON public.service_order_equipments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_equipments_insert ON public.service_order_equipments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_equipments_update ON public.service_order_equipments
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY service_order_equipments_delete ON public.service_order_equipments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON public.equipments TO authenticated;
GRANT ALL ON public.service_order_equipments TO authenticated;
