ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS notes TEXT;
