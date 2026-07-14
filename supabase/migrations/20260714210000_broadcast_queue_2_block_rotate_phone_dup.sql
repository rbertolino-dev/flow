-- Em rotate/single: no máximo 1 linha ativa por (campanha, telefone).
-- Em separate: permite o mesmo telefone em instâncias diferentes (índice phone+instance).

CREATE OR REPLACE FUNCTION public.broadcast_queue_2_block_rotate_phone_dup()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  method text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.phone IS NOT DISTINCT FROM OLD.phone
     AND NEW.campaign_id IS NOT DISTINCT FROM OLD.campaign_id
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'scheduled', 'sending') THEN
    RETURN NEW;
  END IF;

  SELECT c.sending_method INTO method
  FROM public.broadcast_campaigns_2 c
  WHERE c.id = NEW.campaign_id;

  IF COALESCE(method, 'single') = 'separate' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.broadcast_queue_2 q
    WHERE q.campaign_id = NEW.campaign_id
      AND q.phone = NEW.phone
      AND q.id IS DISTINCT FROM NEW.id
      AND q.status IN ('pending', 'scheduled', 'sending')
  ) THEN
    RAISE EXCEPTION
      'broadcast_queue_2: telefone duplicado na campanha (modo %); um WhatsApp só pode ter uma mensagem ativa',
      COALESCE(method, 'single')
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_queue_2_block_rotate_phone_dup ON public.broadcast_queue_2;

CREATE TRIGGER trg_broadcast_queue_2_block_rotate_phone_dup
  BEFORE INSERT OR UPDATE OF phone, campaign_id, status
  ON public.broadcast_queue_2
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_queue_2_block_rotate_phone_dup();

COMMENT ON FUNCTION public.broadcast_queue_2_block_rotate_phone_dup() IS
  'Bloqueia WhatsApp repetido em filas rotate/single; modo separate permanece permitido.';
