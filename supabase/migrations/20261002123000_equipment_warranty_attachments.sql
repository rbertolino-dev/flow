-- Garantia do equipamento e anexos (foto/PDF) no detalhe

ALTER TABLE public.equipments
  ADD COLUMN IF NOT EXISTS purchased_at DATE,
  ADD COLUMN IF NOT EXISTS warranty_until DATE;

CREATE TABLE IF NOT EXISTS public.equipment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer NOT NULL,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT equipment_attachments_size_cap CHECK (file_size > 0 AND file_size <= 5242880)
);

CREATE INDEX IF NOT EXISTS idx_equipment_attachments_equipment
  ON public.equipment_attachments (equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_attachments_org
  ON public.equipment_attachments (organization_id);

COMMENT ON TABLE public.equipment_attachments IS
  'Fotos e PDFs do equipamento (ate 5 MB). Bucket whatsapp-workflow-media em org/equipment-attachments/equipment_id/';

ALTER TABLE public.equipment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_attachments_select ON public.equipment_attachments;
DROP POLICY IF EXISTS equipment_attachments_insert ON public.equipment_attachments;
DROP POLICY IF EXISTS equipment_attachments_delete ON public.equipment_attachments;

CREATE POLICY equipment_attachments_select ON public.equipment_attachments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY equipment_attachments_insert ON public.equipment_attachments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.equipments e
      WHERE e.id = equipment_attachments.equipment_id
        AND e.organization_id = equipment_attachments.organization_id
    )
  );

CREATE POLICY equipment_attachments_delete ON public.equipment_attachments
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

GRANT ALL ON public.equipment_attachments TO authenticated;
