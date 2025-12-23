-- Add excluded_from_funnel column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS excluded_from_funnel boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_excluded_from_funnel ON public.leads(excluded_from_funnel);