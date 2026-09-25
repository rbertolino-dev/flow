-- Finalizado é a etapa obrigatória que encerra a ordem de serviço.

INSERT INTO public.service_order_statuses (organization_id, name, color, sort_order, is_final, is_default)
SELECT o.id,
       'Finalizado',
       '#22c55e',
       COALESCE((SELECT MAX(s.sort_order) FROM public.service_order_statuses s WHERE s.organization_id = o.id), 0) + 10,
       true,
       false
FROM public.organizations o
WHERE EXISTS (
  SELECT 1 FROM public.service_order_statuses s WHERE s.organization_id = o.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.service_order_statuses s
  WHERE s.organization_id = o.id
    AND lower(trim(s.name)) = 'finalizado'
);

UPDATE public.service_order_statuses
SET is_final = false
WHERE lower(trim(name)) <> 'finalizado'
  AND is_final = true;

UPDATE public.service_order_statuses AS status
SET is_final = true,
    name = 'Finalizado'
WHERE lower(trim(status.name)) = 'finalizado'
  AND status.id = (
    SELECT keeper.id
    FROM public.service_order_statuses AS keeper
    WHERE keeper.organization_id = status.organization_id
      AND lower(trim(keeper.name)) = 'finalizado'
    ORDER BY keeper.created_at ASC
    LIMIT 1
  );
