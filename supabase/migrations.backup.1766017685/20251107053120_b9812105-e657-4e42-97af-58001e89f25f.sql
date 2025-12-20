-- Criar tabela para mensagens agendadas
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  instance_id UUID NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'document')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own scheduled messages"
  ON public.scheduled_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled messages"
  ON public.scheduled_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled messages"
  ON public.scheduled_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled messages"
  ON public.scheduled_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhorar performance
CREATE INDEX idx_scheduled_messages_user_status 
  ON public.scheduled_messages(user_id, status);

CREATE INDEX idx_scheduled_messages_scheduled_for 
  ON public.scheduled_messages(scheduled_for) 
  WHERE status = 'pending';