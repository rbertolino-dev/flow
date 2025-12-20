-- Create table to link tags with call queue items
CREATE TABLE IF NOT EXISTS public.call_queue_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_queue_id UUID NOT NULL REFERENCES public.call_queue(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(call_queue_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.call_queue_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for call_queue_tags
CREATE POLICY "Users can view tags on their call queue items"
ON public.call_queue_tags
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add tags to their call queue items"
ON public.call_queue_tags
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove tags from their call queue items"
ON public.call_queue_tags
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.call_queue cq
    JOIN public.leads l ON l.id = cq.lead_id
    WHERE cq.id = call_queue_tags.call_queue_id
    AND l.user_id = auth.uid()
  )
);