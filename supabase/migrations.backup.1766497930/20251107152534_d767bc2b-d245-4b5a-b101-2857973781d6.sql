-- Add read-only super admin access (admins or users in org containing 'pubdigital')
-- This keeps existing org-scoped policies for INSERT/UPDATE/DELETE intact

-- LEADS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all leads"
  ON public.leads
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue"
  ON public.call_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE HISTORY
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_history"
  ON public.call_queue_history
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CALL QUEUE TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all call_queue_tags"
  ON public.call_queue_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ACTIVITIES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all activities"
  ON public.activities
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LEAD TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all lead_tags"
  ON public.lead_tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TAGS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all tags"
  ON public.tags
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MESSAGE TEMPLATES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all message_templates"
  ON public.message_templates
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SCHEDULED MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all scheduled_messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INTERNATIONAL CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all international_contacts"
  ON public.international_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP MESSAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- WHATSAPP LID CONTACTS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all whatsapp_lid_contacts"
  ON public.whatsapp_lid_contacts
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST CAMPAIGNS
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_campaigns"
  ON public.broadcast_campaigns
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BROADCAST QUEUE
DO $$ BEGIN
  CREATE POLICY "Super admins can view all broadcast_queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PIPELINE STAGES
DO $$ BEGIN
  CREATE POLICY "Super admins can view all pipeline_stages"
  ON public.pipeline_stages
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EVOLUTION CONFIG
DO $$ BEGIN
  CREATE POLICY "Super admins can view all evolution_config"
  ON public.evolution_config
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;