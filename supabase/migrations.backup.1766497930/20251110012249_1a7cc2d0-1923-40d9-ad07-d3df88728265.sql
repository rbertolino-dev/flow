-- Criar função para incrementar contador de mensagens não lidas
CREATE OR REPLACE FUNCTION increment_unread_count(lead_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE leads 
  SET unread_message_count = COALESCE(unread_message_count, 0) + 1
  WHERE id = lead_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;