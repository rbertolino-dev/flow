-- Tag de qual Evolution cada instância pertence + helper para sincronizar
-- providers habilitados na organização.

CREATE OR REPLACE FUNCTION public.normalize_evolution_api_url(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_url IS NULL OR btrim(p_url) = '' THEN NULL
    ELSE
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(btrim(p_url)),
            '/+$',
            ''
          ),
          '/(manager|dashboard|app)$',
          ''
        ),
        '^http://',
        'https://'
      )
  END
$$;

COMMENT ON FUNCTION public.normalize_evolution_api_url(text) IS
  'Normaliza URL da Evolution (https, sem barra final, sem /manager|/dashboard|/app) para comparar instância x provider.';

CREATE OR REPLACE FUNCTION public.match_evolution_provider_id(p_url text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.id
  FROM public.evolution_providers ep
  WHERE ep.is_active = true
    AND public.normalize_evolution_api_url(ep.api_url) = public.normalize_evolution_api_url(p_url)
  ORDER BY ep.updated_at DESC NULLS LAST
  LIMIT 1
$$;

COMMENT ON FUNCTION public.match_evolution_provider_id(text) IS
  'Retorna o evolution_providers.id cuja api_url normalizada coincide com a URL informada.';

ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS evolution_provider_id uuid REFERENCES public.evolution_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evolution_config_provider
  ON public.evolution_config (evolution_provider_id);

CREATE INDEX IF NOT EXISTS idx_evolution_config_org_provider
  ON public.evolution_config (organization_id, evolution_provider_id);

COMMENT ON COLUMN public.evolution_config.evolution_provider_id IS
  'Provider Evolution (evo 30, api.ordemservico, etc.) ao qual esta instância pertence.';

UPDATE public.evolution_config ec
SET evolution_provider_id = public.match_evolution_provider_id(ec.api_url)
WHERE ec.evolution_provider_id IS NULL
  AND ec.api_url IS NOT NULL
  AND public.match_evolution_provider_id(ec.api_url) IS NOT NULL;

GRANT EXECUTE ON FUNCTION public.normalize_evolution_api_url(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.match_evolution_provider_id(text) TO authenticated, service_role;
