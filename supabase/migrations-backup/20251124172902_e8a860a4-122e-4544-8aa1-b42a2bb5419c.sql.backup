-- Fix RLS policies for follow_up_templates to use security definer functions

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view templates from their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON follow_up_templates;
DROP POLICY IF EXISTS "Users can delete templates in their organization" ON follow_up_templates;

-- Create new policies using security definer functions
CREATE POLICY "Users can view templates from their organization"
  ON follow_up_templates FOR SELECT
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can create templates in their organization"
  ON follow_up_templates FOR INSERT
  WITH CHECK (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can update templates in their organization"
  ON follow_up_templates FOR UPDATE
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

CREATE POLICY "Users can delete templates in their organization"
  ON follow_up_templates FOR DELETE
  USING (public.user_belongs_to_org(auth.uid(), organization_id));

-- Fix RLS policies for follow_up_template_steps
DROP POLICY IF EXISTS "Users can view steps from their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can create steps in their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can update steps in their templates" ON follow_up_template_steps;
DROP POLICY IF EXISTS "Users can delete steps from their templates" ON follow_up_template_steps;

CREATE POLICY "Users can view steps from their templates"
  ON follow_up_template_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can create steps in their templates"
  ON follow_up_template_steps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update steps in their templates"
  ON follow_up_template_steps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can delete steps from their templates"
  ON follow_up_template_steps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_templates
      WHERE id = follow_up_template_steps.template_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

-- Fix RLS policies for follow_up_step_automations
DROP POLICY IF EXISTS "Users can view automations from their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can create automations in their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can update automations in their steps" ON follow_up_step_automations;
DROP POLICY IF EXISTS "Users can delete automations from their steps" ON follow_up_step_automations;

CREATE POLICY "Users can view automations from their steps"
  ON follow_up_step_automations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can create automations in their steps"
  ON follow_up_step_automations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can update automations in their steps"
  ON follow_up_step_automations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

CREATE POLICY "Users can delete automations from their steps"
  ON follow_up_step_automations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM follow_up_template_steps fts
      JOIN follow_up_templates ft ON ft.id = fts.template_id
      WHERE fts.id = follow_up_step_automations.step_id
      AND public.user_belongs_to_org(auth.uid(), ft.organization_id)
    )
  );

-- Fix RLS policies for lead_follow_ups
DROP POLICY IF EXISTS "Users can view follow-ups from their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can create follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can update follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can delete follow-ups from their leads" ON lead_follow_ups;

CREATE POLICY "Users can view follow-ups from their leads"
  ON lead_follow_ups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
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
  );

CREATE POLICY "Users can update follow-ups in their leads"
  ON lead_follow_ups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leads
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
  );

-- Fix RLS policies for lead_follow_up_step_completions
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
  );