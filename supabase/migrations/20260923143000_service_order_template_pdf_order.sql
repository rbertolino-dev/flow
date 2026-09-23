-- Campos do modelo: o que entra no PDF e checklist padrão do modelo

ALTER TABLE public.service_order_template_fields
  ADD COLUMN IF NOT EXISTS include_in_pdf BOOLEAN NOT NULL DEFAULT true;

UPDATE public.service_order_template_fields
SET include_in_pdf = false
WHERE field_key IN ('add_to_agilize_calendar', 'add_to_google_calendar');

ALTER TABLE public.service_order_template_checklists
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_so_template_checklists_one_default
  ON public.service_order_template_checklists (template_id)
  WHERE is_default = true;
