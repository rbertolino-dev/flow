-- Ensure RLS and secure, consistent inserts into call_queue and call_queue_history
-- 1) Enable RLS on both tables
ALTER TABLE IF EXISTS public.call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_queue_history ENABLE ROW LEVEL SECURITY;

-- 2) Drop & recreate triggers to set organization_id and audit fields
-- call_queue triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_set_org') THEN
    DROP TRIGGER trg_call_queue_set_org ON public.call_queue;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_audit') THEN
    DROP TRIGGER trg_call_queue_audit ON public.call_queue;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_call_queue_update_updated_at') THEN
    DROP TRIGGER trg_call_queue_update_updated_at ON public.call_queue;
  END IF;
END $$;

CREATE TRIGGER trg_call_queue_set_org
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_organization();

CREATE TRIGGER trg_call_queue_audit
BEFORE INSERT OR UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_audit();

CREATE TRIGGER trg_call_queue_update_updated_at
BEFORE UPDATE ON public.call_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- call_queue_history triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cq_hist_set_org') THEN
    DROP TRIGGER trg_cq_hist_set_org ON public.call_queue_history;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cq_hist_update_updated_at') THEN
    DROP TRIGGER trg_cq_hist_update_updated_at ON public.call_queue_history;
  END IF;
END $$;

CREATE TRIGGER trg_cq_hist_set_org
BEFORE INSERT OR UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.set_call_queue_history_organization();

CREATE TRIGGER trg_cq_hist_update_updated_at
BEFORE UPDATE ON public.call_queue_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill missing organization_id from leads, for consistency
UPDATE public.call_queue cq
SET organization_id = l.organization_id
FROM public.leads l
WHERE cq.lead_id = l.id AND cq.organization_id IS NULL;

UPDATE public.call_queue_history cqh
SET organization_id = l.organization_id
FROM public.leads l
WHERE cqh.lead_id = l.id AND cqh.organization_id IS NULL;

-- 4) Unique constraint to avoid duplicate active queue items per lead+org
CREATE UNIQUE INDEX IF NOT EXISTS uq_call_queue_active_by_lead_org
ON public.call_queue (lead_id, organization_id)
WHERE status IN ('pending','rescheduled');

-- 5) RLS policies: allow org members to operate; restrict updates/deletes to owner/admins or creator
-- Drop existing policies if they exist (to avoid duplicates) and recreate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can select'
  ) THEN
    DROP POLICY "Call queue: members can select" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can insert'
  ) THEN
    DROP POLICY "Call queue: members can insert" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can update own or admin'
  ) THEN
    DROP POLICY "Call queue: members can update own or admin" ON public.call_queue;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue' 
      AND policyname = 'Call queue: members can delete own or admin'
  ) THEN
    DROP POLICY "Call queue: members can delete own or admin" ON public.call_queue;
  END IF;
END $$;

-- SELECT for org members
DROP POLICY IF EXISTS "Call queue: members can select" ON public.call_queue;
CREATE POLICY "Call queue: members can select" ON public.call_queue
CREATE POLICY "Call queue: members can select" ON public.call_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

-- INSERT restricted to org members; row after BEFORE triggers must satisfy created_by = auth.uid()
DROP POLICY IF EXISTS "Call queue: members can insert" ON public.call_queue;
CREATE POLICY "Call queue: members can insert" ON public.call_queue
CREATE POLICY "Call queue: members can insert" ON public.call_queue
FOR INSERT
WITH CHECK (
  (created_by = auth.uid()) AND (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = call_queue.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
);

-- UPDATE allowed to creator or admins within same org
DROP POLICY IF EXISTS "Call queue: members can update own or admin" ON public.call_queue;
CREATE POLICY "Call queue: members can update own or admin" ON public.call_queue
CREATE POLICY "Call queue: members can update own or admin" ON public.call_queue
FOR UPDATE
USING (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

-- DELETE allowed to creator or admins within same org
DROP POLICY IF EXISTS "Call queue: members can delete own or admin" ON public.call_queue;
CREATE POLICY "Call queue: members can delete own or admin" ON public.call_queue
CREATE POLICY "Call queue: members can delete own or admin" ON public.call_queue
FOR DELETE
USING (
  (
    created_by = auth.uid()
    OR public.user_is_org_admin(auth.uid(), call_queue.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policies for call_queue_history (read/insert by org members)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue_history' 
      AND policyname = 'CQ history: members can select'
  ) THEN
    DROP POLICY "CQ history: members can select" ON public.call_queue_history;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'call_queue_history' 
      AND policyname = 'CQ history: members can insert'
  ) THEN
    DROP POLICY "CQ history: members can insert" ON public.call_queue_history;
  END IF;
END $$;

DROP POLICY IF EXISTS "CQ history: members can select" ON public.call_queue_history;
CREATE POLICY "CQ history: members can select" ON public.call_queue_history
CREATE POLICY "CQ history: members can select" ON public.call_queue_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue_history.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "CQ history: members can insert" ON public.call_queue_history;
CREATE POLICY "CQ history: members can insert" ON public.call_queue_history
CREATE POLICY "CQ history: members can insert" ON public.call_queue_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = call_queue_history.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.user_is_org_admin(auth.uid(), call_queue_history.organization_id)
  OR public.is_pubdigital_user(auth.uid())
);

-- 6) Ensure authenticated users can call the secure RPC
GRANT EXECUTE ON FUNCTION public.add_to_call_queue_secure(uuid, timestamptz, text, text) TO authenticated;
