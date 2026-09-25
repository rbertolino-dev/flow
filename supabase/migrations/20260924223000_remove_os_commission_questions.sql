-- Remove as perguntas de comissão dos modelos de ordem de serviço.
DELETE FROM public.service_order_template_fields
WHERE field_key IN ('has_commission', 'commission_value');
