-- Add organization_id column to broadcast_queue
ALTER TABLE public.broadcast_queue 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create index for better query performance
CREATE INDEX idx_broadcast_queue_org_id ON public.broadcast_queue(organization_id);
CREATE INDEX idx_broadcast_queue_status_sent_at ON public.broadcast_queue(status, sent_at) WHERE status = 'sent';

-- Create trigger function to automatically set organization_id
CREATE OR REPLACE FUNCTION public.set_broadcast_queue_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Get organization_id from campaign
  SELECT bc.organization_id INTO NEW.organization_id
  FROM public.broadcast_campaigns bc
  WHERE bc.id = NEW.campaign_id;
  
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Campaign % does not have an organization', NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER set_broadcast_queue_org_before_insert
  BEFORE INSERT ON public.broadcast_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_broadcast_queue_organization();

-- Backfill existing records
UPDATE public.broadcast_queue bq
SET organization_id = bc.organization_id
FROM public.broadcast_campaigns bc
WHERE bq.campaign_id = bc.id
  AND bq.organization_id IS NULL;

-- Make organization_id NOT NULL after backfill
ALTER TABLE public.broadcast_queue 
ALTER COLUMN organization_id SET NOT NULL;

-- Add RLS policies for broadcast_queue with organization_id
DROP POLICY IF EXISTS "Users can view queue of their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can insert queue for their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can update queue of their campaigns" ON public.broadcast_queue;
DROP POLICY IF EXISTS "Users can delete queue of their campaigns" ON public.broadcast_queue;

CREATE POLICY "Users can view organization broadcast queue"
  ON public.broadcast_queue
  FOR SELECT
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can insert organization broadcast queue"
  ON public.broadcast_queue
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can update organization broadcast queue"
  ON public.broadcast_queue
  FOR UPDATE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can delete organization broadcast queue"
  ON public.broadcast_queue
  FOR DELETE
  USING (
    organization_id = get_user_organization(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_pubdigital_user(auth.uid())
  );