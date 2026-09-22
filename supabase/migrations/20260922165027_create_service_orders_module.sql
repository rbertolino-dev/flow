-- Módulo Ordem de Serviço: modelos personalizáveis, OS, itens (produtos/serviços), checklist e status

-- Contador de código por organização
CREATE TABLE IF NOT EXISTS public.service_order_counters (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_number BIGINT NOT NULL DEFAULT 0
);

-- Status personalizados da OS (ex.: Compra de material, Fabricação, Finalizado)
CREATE TABLE IF NOT EXISTS public.service_order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  sort_order INT NOT NULL DEFAULT 0,
  is_final BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_statuses_org
  ON public.service_order_statuses (organization_id, sort_order);

-- Modelos de criação de OS (padrão + personalizados)
CREATE TABLE IF NOT EXISTS public.service_order_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_templates_org
  ON public.service_order_templates (organization_id, is_active, sort_order);

-- Campos do modelo (padrão do sistema + personalizados)
CREATE TABLE IF NOT EXISTS public.service_order_template_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.service_order_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text'
    CHECK (field_type IN (
      'text', 'textarea', 'number', 'date', 'datetime', 'boolean',
      'select', 'lead', 'user', 'service', 'equipment'
    )),
  is_standard BOOLEAN NOT NULL DEFAULT false,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  placeholder TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  default_value TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  section TEXT DEFAULT 'geral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_so_template_fields_template
  ON public.service_order_template_fields (template_id, sort_order);

-- Ordens de serviço
CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  template_id UUID REFERENCES public.service_order_templates(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.service_order_statuses(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_name TEXT,
  client_phone TEXT,
  responsible_name TEXT,
  responsible_user_id UUID REFERENCES public.profiles(id),
  collaborator_name TEXT,
  collaborator_user_id UUID REFERENCES public.profiles(id),
  service_name TEXT,
  service_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_single_day BOOLEAN NOT NULL DEFAULT true,
  address TEXT,
  has_commission BOOLEAN NOT NULL DEFAULT false,
  commission_value NUMERIC(12,2) DEFAULT 0,
  equipment_serial TEXT,
  equipment_conditions TEXT,
  client_report TEXT,
  diagnosis TEXT,
  solution TEXT,
  warranty_terms TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  label_tag TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  add_to_agilize_calendar BOOLEAN NOT NULL DEFAULT false,
  add_to_google_calendar BOOLEAN NOT NULL DEFAULT false,
  reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_service_orders_org
  ON public.service_orders (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_status
  ON public.service_orders (organization_id, status_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_lead
  ON public.service_orders (organization_id, lead_id)
  WHERE deleted_at IS NULL AND lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_orders_code
  ON public.service_orders (organization_id, code)
  WHERE deleted_at IS NULL;

-- Produtos/serviços gastos na execução da OS
CREATE TABLE IF NOT EXISTS public.service_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service')),
  item_id UUID,
  name TEXT NOT NULL,
  sku TEXT,
  unit TEXT DEFAULT 'un',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  use_cost BOOLEAN NOT NULL DEFAULT false,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_items_order
  ON public.service_order_items (service_order_id);
CREATE INDEX IF NOT EXISTS idx_so_items_org
  ON public.service_order_items (organization_id);

-- Checklist da OS
CREATE TABLE IF NOT EXISTS public.service_order_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_checklist_order
  ON public.service_order_checklist_items (service_order_id, sort_order);

-- Modelos de checklist reutilizáveis
CREATE TABLE IF NOT EXISTS public.service_order_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_so_checklist_tpl_org
  ON public.service_order_checklist_templates (organization_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_service_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_service_orders_updated_at ON public.service_orders;
CREATE TRIGGER trg_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_service_orders_updated_at();

DROP TRIGGER IF EXISTS trg_so_templates_updated_at ON public.service_order_templates;
CREATE TRIGGER trg_so_templates_updated_at
  BEFORE UPDATE ON public.service_order_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_service_orders_updated_at();

DROP TRIGGER IF EXISTS trg_so_statuses_updated_at ON public.service_order_statuses;
CREATE TRIGGER trg_so_statuses_updated_at
  BEFORE UPDATE ON public.service_order_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_service_orders_updated_at();

-- Próximo código sequencial (ex.: 00214)
CREATE OR REPLACE FUNCTION public.next_service_order_code(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num BIGINT;
BEGIN
  INSERT INTO public.service_order_counters (organization_id, last_number)
  VALUES (p_org_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_number = public.service_order_counters.last_number + 1
  RETURNING last_number INTO v_num;

  RETURN lpad(v_num::text, 5, '0');
END;
$$;

-- RLS
ALTER TABLE public.service_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_order_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Policies helper pattern: member of org
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'service_order_counters',
    'service_order_statuses',
    'service_order_templates',
    'service_order_template_fields',
    'service_orders',
    'service_order_items',
    'service_order_checklist_items',
    'service_order_checklist_templates'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR SELECT USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_select', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_insert', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_update', t);

    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        organization_id IN (
          SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
      )
    $p$, t || '_delete', t);
  END LOOP;
END $$;

-- Realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.service_order_counters TO authenticated;
GRANT ALL ON public.service_order_statuses TO authenticated;
GRANT ALL ON public.service_order_templates TO authenticated;
GRANT ALL ON public.service_order_template_fields TO authenticated;
GRANT ALL ON public.service_orders TO authenticated;
GRANT ALL ON public.service_order_items TO authenticated;
GRANT ALL ON public.service_order_checklist_items TO authenticated;
GRANT ALL ON public.service_order_checklist_templates TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_service_order_code(UUID) TO authenticated;
