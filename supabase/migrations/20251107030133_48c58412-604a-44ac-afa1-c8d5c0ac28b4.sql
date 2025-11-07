-- Criar tabela para histórico da fila de ligações
CREATE TABLE IF NOT EXISTS public.call_queue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by TEXT,
  completed_by_user_id UUID,
  status TEXT NOT NULL,
  priority TEXT,
  notes TEXT,
  call_notes TEXT,
  call_count INTEGER DEFAULT 0,
  action TEXT NOT NULL, -- 'completed', 'deleted', 'rescheduled'
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_queue_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own call queue history"
ON public.call_queue_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call queue history"
ON public.call_queue_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own call queue history"
ON public.call_queue_history
FOR DELETE
USING (auth.uid() = user_id);

-- Criar índice para melhor performance
CREATE INDEX idx_call_queue_history_user_id ON public.call_queue_history(user_id);
CREATE INDEX idx_call_queue_history_created_at ON public.call_queue_history(created_at DESC);