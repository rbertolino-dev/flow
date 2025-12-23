-- Create table for tracking Bubble.io message status
CREATE TABLE IF NOT EXISTS public.bubble_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_message_id ON public.bubble_message_tracking(message_id);
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_phone ON public.bubble_message_tracking(phone);
CREATE INDEX IF NOT EXISTS idx_bubble_message_tracking_organization_id ON public.bubble_message_tracking(organization_id);

-- Enable RLS
ALTER TABLE public.bubble_message_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for bubble_message_tracking
CREATE POLICY "Super admins can view all bubble message tracking"
  ON public.bubble_message_tracking FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Users can view their org bubble message tracking"
  ON public.bubble_message_tracking FOR SELECT
  USING (
    user_belongs_to_org(auth.uid(), organization_id) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Service can insert bubble message tracking"
  ON public.bubble_message_tracking FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update bubble message tracking"
  ON public.bubble_message_tracking FOR UPDATE
  USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_bubble_message_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bubble_message_tracking_updated_at
  BEFORE UPDATE ON public.bubble_message_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bubble_message_tracking_updated_at();