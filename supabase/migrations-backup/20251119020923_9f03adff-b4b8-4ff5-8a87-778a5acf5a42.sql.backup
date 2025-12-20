-- Add response_format and split_messages columns to agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS response_format text,
  ADD COLUMN IF NOT EXISTS split_messages integer;

-- Add comments for documentation
COMMENT ON COLUMN public.agents.response_format IS 'Format of the response: text or json';
COMMENT ON COLUMN public.agents.split_messages IS 'Maximum number of characters per message when splitting';