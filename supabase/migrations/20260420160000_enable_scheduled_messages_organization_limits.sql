-- Habilita mensagens agendadas para todas as organizações:
-- - cria organization_limits mínimo onde faltar;
-- - remove bloqueio em disabled_features;
-- - acrescenta em enabled_features onde ainda não estiver.

-- 0) Organizações sem linha em organization_limits (feature só aparece se existir limits + flag)
INSERT INTO public.organization_limits (organization_id, enabled_features)
SELECT o.id, '["scheduled_messages"]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_limits ol WHERE ol.organization_id = o.id
);

-- 1) Remover bloqueio explícito em disabled_features, se existir
UPDATE public.organization_limits
SET disabled_features = COALESCE(
  (
    SELECT jsonb_agg(to_jsonb(v))
    FROM jsonb_array_elements_text(COALESCE(disabled_features, '[]'::jsonb)) AS t(v)
    WHERE v IS DISTINCT FROM 'scheduled_messages'
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof(COALESCE(disabled_features, '[]'::jsonb)) = 'array'
  AND COALESCE(disabled_features, '[]'::jsonb) @> '["scheduled_messages"]'::jsonb;

-- 2) Incluir scheduled_messages em enabled_features (merge em array JSONB)
UPDATE public.organization_limits
SET enabled_features = COALESCE(enabled_features, '[]'::jsonb) || '["scheduled_messages"]'::jsonb
WHERE jsonb_typeof(COALESCE(enabled_features, '[]'::jsonb)) = 'array'
  AND NOT (COALESCE(enabled_features, '[]'::jsonb) @> '["scheduled_messages"]'::jsonb);
