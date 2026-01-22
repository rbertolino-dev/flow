  -- =====================================================
  -- FIX: Corrigir RLS policies de lead_follow_ups para todas as organizações
  -- =====================================================
  -- Problema: Erro 403 ao aplicar template no lead
  -- Solução: Garantir que RLS policies estão corretas usando user_belongs_to_org
  --
  -- ⚠️ AÇÕES DESTRUTIVAS IDENTIFICADAS:
  -- 1. DROP POLICY IF EXISTS - Remove apenas as políticas específicas listadas abaixo
  -- 2. CREATE POLICY - Recria as políticas com a mesma lógica, mas corrigida
  --
  -- ✅ GARANTIAS DE SEGURANÇA:
  -- - Usa IF EXISTS para evitar erros se políticas não existirem
  -- - Recria políticas imediatamente após remover (sem período sem proteção)
  -- - Mantém os mesmos nomes de políticas (compatibilidade)
  -- - Não remove outras políticas que possam existir
  -- - Não modifica estrutura de tabelas ou dados
  -- - Não afeta outras funcionalidades do sistema

  BEGIN;

  -- =====================================================
  -- PARTE 1: Atualizar políticas de lead_follow_ups
  -- =====================================================
  -- Remove apenas as 4 políticas específicas que queremos corrigir
  -- Se outras políticas existirem, elas permanecerão intactas

  -- 1.1. Remover política de SELECT (visualização)
  DROP POLICY IF EXISTS "Users can view follow-ups from their leads" ON lead_follow_ups;

  -- 1.2. Recriar política de SELECT corrigida
  CREATE POLICY "Users can view follow-ups from their leads"
    ON lead_follow_ups FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM post_sale_leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
    );

  -- 1.3. Remover política de INSERT (criação)
  DROP POLICY IF EXISTS "Users can create follow-ups in their leads" ON lead_follow_ups;

  -- 1.4. Recriar política de INSERT corrigida
  CREATE POLICY "Users can create follow-ups in their leads"
    ON lead_follow_ups FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM post_sale_leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
    );

  -- 1.5. Remover política de UPDATE (atualização)
  DROP POLICY IF EXISTS "Users can update follow-ups in their leads" ON lead_follow_ups;

  -- 1.6. Recriar política de UPDATE corrigida
  CREATE POLICY "Users can update follow-ups in their leads"
    ON lead_follow_ups FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM post_sale_leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
    );

  -- 1.7. Remover política de DELETE (exclusão)
  DROP POLICY IF EXISTS "Users can delete follow-ups from their leads" ON lead_follow_ups;

  -- 1.8. Recriar política de DELETE corrigida
  CREATE POLICY "Users can delete follow-ups from their leads"
    ON lead_follow_ups FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM post_sale_leads
        WHERE id = lead_follow_ups.lead_id
        AND public.user_belongs_to_org(auth.uid(), organization_id)
      )
    );

  -- =====================================================
  -- PARTE 2: Atualizar políticas de lead_follow_up_step_completions
  -- =====================================================
  -- Remove apenas as 3 políticas específicas que queremos corrigir
  -- Se outras políticas existirem, elas permanecerão intactas

  -- 2.1. Remover política de SELECT (visualização)
  DROP POLICY IF EXISTS "Users can view step completions from their follow-ups" ON lead_follow_up_step_completions;

  -- 2.2. Recriar política de SELECT corrigida
  CREATE POLICY "Users can view step completions from their follow-ups"
    ON lead_follow_up_step_completions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN leads l ON l.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), l.organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN post_sale_leads psl ON psl.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
      )
    );

  -- 2.3. Remover política de INSERT (criação)
  DROP POLICY IF EXISTS "Users can create step completions in their follow-ups" ON lead_follow_up_step_completions;

  -- 2.4. Recriar política de INSERT corrigida
  CREATE POLICY "Users can create step completions in their follow-ups"
    ON lead_follow_up_step_completions FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN leads l ON l.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), l.organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN post_sale_leads psl ON psl.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
      )
    );

  -- 2.5. Remover política de DELETE (exclusão)
  DROP POLICY IF EXISTS "Users can delete step completions from their follow-ups" ON lead_follow_up_step_completions;

  -- 2.6. Recriar política de DELETE corrigida
  CREATE POLICY "Users can delete step completions from their follow-ups"
    ON lead_follow_up_step_completions FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN leads l ON l.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), l.organization_id)
      )
      OR EXISTS (
        SELECT 1 FROM lead_follow_ups lfu
        JOIN post_sale_leads psl ON psl.id = lfu.lead_id
        WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
        AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
      )
    );

  COMMIT;

  -- =====================================================
  -- VERIFICAÇÃO PÓS-EXECUÇÃO (opcional - pode ser executado separadamente)
  -- =====================================================
  -- Para verificar se as políticas foram criadas corretamente:
  --
  -- SELECT 
  --   schemaname,
  --   tablename,
  --   policyname,
  --   permissive,
  --   roles,
  --   cmd,
  --   qual,
  --   with_check
  -- FROM pg_policies
  -- WHERE tablename IN ('lead_follow_ups', 'lead_follow_up_step_completions')
  -- ORDER BY tablename, policyname;
