-- Add message_variations column to broadcast_campaign_templates
ALTER TABLE public.broadcast_campaign_templates
ADD COLUMN message_variations JSONB DEFAULT '[]'::jsonb;