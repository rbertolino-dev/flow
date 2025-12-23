-- =====================================================
-- FIX: Permitir follow-ups em post_sale_leads
-- =====================================================
-- O problema: lead_follow_ups só verifica leads, mas precisa verificar também post_sale_leads
-- Solução: Atualizar políticas RLS para aceitar ambos

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view follow-ups from their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can create follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can update follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can delete follow-ups from their leads" ON lead_follow_ups;

-- Create new policies that check both leads and post_sale_leads
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

-- Fix RLS policies for lead_follow_up_step_completions to also check post_sale_leads
DROP POLICY IF EXISTS "Users can view step completions from their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can create step completions in their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can delete step completions from their follow-ups" ON lead_follow_up_step_completions;

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

