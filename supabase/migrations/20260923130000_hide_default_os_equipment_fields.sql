-- Modelo padrão da OS: ocultar campos de equipamento já criados

UPDATE public.service_order_template_fields AS f
SET is_visible = false
FROM public.service_order_templates AS t
WHERE f.template_id = t.id
  AND t.is_default = true
  AND f.field_key IN ('equipment_serial', 'equipment_conditions');
