-- Exportar mapeamento lead → etapa do projeto CLONADO do backup.
-- Executar no SQL Editor do projeto temporário (Restore to new project).
-- Salvar resultado como CSV: lead_id, name, stage_id, stage_name

SELECT
  l.id AS lead_id,
  l.name,
  l.stage_id,
  ps.name AS stage_name,
  ps.position AS stage_position
FROM public.leads l
LEFT JOIN public.pipeline_stages ps ON ps.id = l.stage_id
WHERE l.organization_id = '20b10048-88c4-4a9e-b72a-ac1c407e95c6'
  AND l.deleted_at IS NULL
ORDER BY ps.position NULLS LAST, l.name;

-- Validação: distribuição esperada antes do incidente
SELECT
  COALESCE(ps.name, '(sem etapa)') AS etapa,
  ps.position,
  COUNT(*) AS leads
FROM public.leads l
LEFT JOIN public.pipeline_stages ps ON ps.id = l.stage_id
WHERE l.organization_id = '20b10048-88c4-4a9e-b72a-ac1c407e95c6'
  AND l.deleted_at IS NULL
GROUP BY ps.id, ps.name, ps.position
ORDER BY ps.position NULLS LAST;
