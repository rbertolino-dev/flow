-- Adicionar constraint única para prevenir etapas duplicadas na mesma org
-- (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_org_name_unique 
ON pipeline_stages (organization_id, LOWER(name));

-- Adicionar comentário explicativo
COMMENT ON INDEX pipeline_stages_org_name_unique IS 
'Previne criação de etapas com nomes duplicados (case-insensitive) na mesma organização';