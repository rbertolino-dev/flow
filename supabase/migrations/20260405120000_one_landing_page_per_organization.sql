-- Uma única landing page por organização (regra de produto + integridade no banco)
-- Remove duplicatas existentes e cria índice único em organization_id.

-- Manter, por organização: página ativa (se houver); senão a mais recentemente atualizada/criada.
DELETE FROM public.landing_pages lp
WHERE lp.id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY organization_id
             ORDER BY is_active DESC, updated_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM public.landing_pages
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_pages_one_per_organization
  ON public.landing_pages (organization_id);

COMMENT ON INDEX idx_landing_pages_one_per_organization IS
  'Cada organização possui no máximo um registro em landing_pages.';
