ALTER TABLE public.service_order_templates
  ADD COLUMN IF NOT EXISTS pdf_layout TEXT NOT NULL DEFAULT 'page';

ALTER TABLE public.service_order_templates
  DROP CONSTRAINT IF EXISTS service_order_templates_pdf_layout_check;

ALTER TABLE public.service_order_templates
  ADD CONSTRAINT service_order_templates_pdf_layout_check
  CHECK (pdf_layout IN ('page', 'three_slips'));

ALTER TABLE public.service_order_templates
  ADD COLUMN IF NOT EXISTS slip_config JSONB NOT NULL DEFAULT '[
    {"key":"1","label":"Via 1","subtitle":"","color":"#2563eb","footer":"none"},
    {"key":"2","label":"Via 2","subtitle":"","color":"#7c3aed","footer":"none"},
    {"key":"3","label":"Via 3","subtitle":"","color":"#059669","footer":"none"}
  ]'::jsonb;

ALTER TABLE public.service_order_template_fields
  DROP CONSTRAINT IF EXISTS service_order_template_fields_field_type_check;

ALTER TABLE public.service_order_template_fields
  ADD CONSTRAINT service_order_template_fields_field_type_check
  CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime', 'boolean',
    'select', 'lead', 'user', 'service', 'equipment', 'table'
  ));

ALTER TABLE public.service_order_template_fields
  ADD COLUMN IF NOT EXISTS pdf_vias JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.service_order_template_fields
  ADD COLUMN IF NOT EXISTS section_by_via JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.service_order_template_fields
  ADD COLUMN IF NOT EXISTS table_config JSONB;
