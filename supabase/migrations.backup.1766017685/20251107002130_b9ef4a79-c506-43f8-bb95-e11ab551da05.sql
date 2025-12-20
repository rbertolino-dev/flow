-- Add call_count column to leads table to track total calls per lead
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;