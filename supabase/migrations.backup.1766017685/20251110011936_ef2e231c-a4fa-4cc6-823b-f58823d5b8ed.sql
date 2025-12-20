-- Adicionar campos para rastrear mensagens não lidas nos leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS has_unread_messages BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unread_message_count INTEGER DEFAULT 0;