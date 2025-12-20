-- Corrigir pipeline_stages sem organization_id
UPDATE pipeline_stages ps
SET organization_id = om.organization_id
FROM organization_members om
WHERE ps.organization_id IS NULL
  AND ps.user_id = om.user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = ps.user_id
    LIMIT 1
  );

-- Deletar pipeline_stages órfãos (sem organização e sem usuário válido)
DELETE FROM pipeline_stages
WHERE organization_id IS NULL;

-- Corrigir message_templates sem organization_id
UPDATE message_templates mt
SET organization_id = om.organization_id
FROM organization_members om
WHERE mt.organization_id IS NULL
  AND mt.user_id = om.user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.user_id = mt.user_id
    LIMIT 1
  );

-- Deletar message_templates órfãos
DELETE FROM message_templates
WHERE organization_id IS NULL;

-- Garantir que organization_id não seja NULL nas tabelas principais
-- (vamos tornar a coluna NOT NULL após limpeza)
ALTER TABLE pipeline_stages 
  ALTER COLUMN organization_id SET NOT NULL;

-- Verificação final
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Verificar se ainda existem registros órfãos
  SELECT COUNT(*) INTO orphan_count
  FROM (
    SELECT id FROM pipeline_stages WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM message_templates WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM leads WHERE organization_id IS NULL
    UNION ALL
    SELECT id FROM evolution_config WHERE organization_id IS NULL
  ) AS orphans;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Ainda existem % registros sem organization_id', orphan_count;
  ELSE
    RAISE NOTICE 'Todos os registros têm organization_id definido ✓';
  END IF;
END $$;