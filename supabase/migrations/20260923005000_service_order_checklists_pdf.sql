-- Checklists reutilizáveis ligados ao modelo da OS e opção de sair no PDF

ALTER TABLE public.service_order_checklist_templates
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS include_in_pdf BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.service_order_checklist_items
  ADD COLUMN IF NOT EXISTS include_in_pdf BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS checklist_template_id UUID
    REFERENCES public.service_order_checklist_templates(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.service_order_template_checklists (
  template_id UUID NOT NULL REFERENCES public.service_order_templates(id) ON DELETE CASCADE,
  checklist_template_id UUID NOT NULL REFERENCES public.service_order_checklist_templates(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, checklist_template_id)
);

CREATE INDEX IF NOT EXISTS idx_so_template_checklists_org
  ON public.service_order_template_checklists (organization_id);

ALTER TABLE public.service_order_template_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_order_template_checklists_select ON public.service_order_template_checklists;
DROP POLICY IF EXISTS service_order_template_checklists_insert ON public.service_order_template_checklists;
DROP POLICY IF EXISTS service_order_template_checklists_update ON public.service_order_template_checklists;
DROP POLICY IF EXISTS service_order_template_checklists_delete ON public.service_order_template_checklists;

CREATE POLICY service_order_template_checklists_select ON public.service_order_template_checklists
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY service_order_template_checklists_insert ON public.service_order_template_checklists
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY service_order_template_checklists_update ON public.service_order_template_checklists
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY service_order_template_checklists_delete ON public.service_order_template_checklists
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON public.service_order_template_checklists TO authenticated;
