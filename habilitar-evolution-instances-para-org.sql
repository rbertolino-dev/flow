-- Habilitar feature evolution_instances para uma organização específica
-- Use este script se a organização não conseguir criar instâncias

-- Substitua o UUID abaixo pelo organization_id da organização
-- Exemplo: f5baab4d-c66b-4726-8613-f32714d3e485

DO $$
DECLARE
  v_org_id UUID := 'f5baab4d-c66b-4726-8613-f32714d3e485'; -- SUBSTITUA PELO ID DA ORGANIZAÇÃO
  v_org_limits RECORD;
BEGIN
  -- Verificar se organização existe
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_org_id) THEN
    RAISE EXCEPTION 'Organização não encontrada: %', v_org_id;
  END IF;
  
  -- Buscar ou criar registro de limites
  SELECT * INTO v_org_limits
  FROM organization_limits
  WHERE organization_id = v_org_id;
  
  IF v_org_limits IS NULL THEN
    -- Criar registro se não existe
    INSERT INTO organization_limits (organization_id, enabled_features, max_evolution_instances)
    VALUES (v_org_id, ARRAY['evolution_instances']::public.organization_feature[], NULL)
    ON CONFLICT (organization_id) DO NOTHING;
    
    RAISE NOTICE 'Registro de limites criado para organização %', v_org_id;
  ELSE
    -- Atualizar registro existente
    -- Se enabled_features está vazio ou NULL, adicionar evolution_instances
    -- Se enabled_features tem valores, adicionar evolution_instances se não estiver presente
    UPDATE organization_limits
    SET enabled_features = CASE
      WHEN enabled_features IS NULL OR array_length(enabled_features, 1) IS NULL THEN
        ARRAY['evolution_instances']::public.organization_feature[]
      WHEN NOT ('evolution_instances'::public.organization_feature = ANY(enabled_features)) THEN
        array_append(enabled_features, 'evolution_instances'::public.organization_feature)
      ELSE
        enabled_features -- Já tem, não precisa adicionar
    END,
    updated_at = now()
    WHERE organization_id = v_org_id;
    
    RAISE NOTICE 'Registro de limites atualizado para organização %', v_org_id;
  END IF;
  
  -- Verificar resultado
  SELECT * INTO v_org_limits
  FROM organization_limits
  WHERE organization_id = v_org_id;
  
  RAISE NOTICE 'Configuração final:';
  RAISE NOTICE '  - enabled_features: %', v_org_limits.enabled_features;
  RAISE NOTICE '  - max_evolution_instances: %', v_org_limits.max_evolution_instances;
  RAISE NOTICE '  - evolution_instances habilitado: %', 
    ('evolution_instances'::public.organization_feature = ANY(v_org_limits.enabled_features));
END $$;

-- Verificar se a função can_create_evolution_instance está funcionando
SELECT 
  public.can_create_evolution_instance('f5baab4d-c66b-4726-8613-f32714d3e485') as pode_criar,
  (SELECT enabled_features FROM organization_limits WHERE organization_id = 'f5baab4d-c66b-4726-8613-f32714d3e485') as features,
  (SELECT COUNT(*) FROM evolution_config WHERE organization_id = 'f5baab4d-c66b-4726-8613-f32714d3e485') as instancias_atuais;

