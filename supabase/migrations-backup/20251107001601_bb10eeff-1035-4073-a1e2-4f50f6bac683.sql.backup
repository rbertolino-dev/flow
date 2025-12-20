-- Add columns to track who completed the call and when
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS completed_by TEXT,
ADD COLUMN IF NOT EXISTS completed_by_user_id UUID;