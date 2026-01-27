-- Migration: Criar Função de Teste Simplificada
-- Data: 2026-01-27
-- Descrição: Cria função de teste que verifica se outras funções existem

-- =====================================================
-- Função de Teste Simplificada
-- =====================================================

CREATE OR REPLACE FUNCTION public.test_diagnostic_functions()
RETURNS TABLE (
  function_name TEXT,
  exists BOOLEAN,
  can_execute BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_error TEXT;
BEGIN
  -- Testar diagnose_landing_page_organization_sync
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.diagnose_landing_page_organization_sync();
    
    RETURN QUERY
    SELECT 
      'diagnose_landing_page_organization_sync'::TEXT,
      true,
      true,
      NULL::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RETURN QUERY
      SELECT 
        'diagnose_landing_page_organization_sync'::TEXT,
        false,
        false,
        v_error;
  END;
  
  -- Testar check_product_visibility
  BEGIN
    -- Verificar se função existe primeiro
    SELECT COUNT(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'check_product_visibility';
    
    IF v_count > 0 THEN
      -- Tentar executar com valores NULL (vai dar erro mas confirma que existe)
      BEGIN
        PERFORM public.check_product_visibility(NULL::UUID, NULL::UUID);
        RETURN QUERY
        SELECT 
          'check_product_visibility'::TEXT,
          true,
          true,
          NULL::TEXT;
      EXCEPTION
        WHEN OTHERS THEN
          GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
          -- Se erro é sobre parâmetro inválido, função existe
          IF v_error LIKE '%não existe%' OR v_error LIKE '%does not exist%' THEN
            RETURN QUERY
            SELECT 
              'check_product_visibility'::TEXT,
              false,
              false,
              v_error;
          ELSE
            RETURN QUERY
            SELECT 
              'check_product_visibility'::TEXT,
              true,
              true,
              'Função existe (erro esperado com parâmetros NULL)';
          END IF;
      END;
    ELSE
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        false,
        false,
        'Função não encontrada no banco de dados';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RETURN QUERY
      SELECT 
        'check_product_visibility'::TEXT,
        false,
        false,
        v_error;
  END;
  
  -- Testar diagnose_landing_page_simple
  BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.diagnose_landing_page_simple();
    
    RETURN QUERY
    SELECT 
      'diagnose_landing_page_simple'::TEXT,
      true,
      true,
      NULL::TEXT;
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      RETURN QUERY
      SELECT 
        'diagnose_landing_page_simple'::TEXT,
        false,
        false,
        v_error;
  END;
END;
$$;

COMMENT ON FUNCTION public.test_diagnostic_functions() IS 
'Testa se as funções de diagnóstico existem e podem ser executadas. Execute: SELECT * FROM public.test_diagnostic_functions();';
