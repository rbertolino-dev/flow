-- Ensure unique constraint for upsert in imports
ALTER TABLE public.leads
ADD CONSTRAINT leads_user_phone_unique UNIQUE (user_id, phone);

-- Helpful index for queries by user and stage (optional but lightweight)
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON public.leads (user_id, stage_id);
