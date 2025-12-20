-- Criar tabela de mensagens do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, audio, image, video, document
  media_url TEXT,
  direction TEXT NOT NULL, -- incoming, outgoing
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_status BOOLEAN DEFAULT false,
  message_id TEXT, -- ID da mensagem do WhatsApp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_phone ON public.whatsapp_messages(user_id, phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_timestamp ON public.whatsapp_messages(user_id, timestamp DESC);

-- Habilitar RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own messages"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.whatsapp_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.whatsapp_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;