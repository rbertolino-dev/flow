-- Add call_notes and call_count columns to call_queue table
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS call_notes TEXT,
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;