-- Ajustar RLS de agendamento usando a organização do lead e criar trigger de preenchimento automático

-- 1) Função para setar organization_id a partir do lead e user_id a partir do auth
CREATE OR REPLACE FUNCTION public.set_scheduled_message_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preencher organization_id a partir do lead se vier nulo
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.leads
    WHERE id = NEW.lead_id;
  END IF;

  -- Garantir user_id = usuário autenticado quando possível
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trg_set_scheduled_message_organization ON public.scheduled_messages;
CREATE TRIGGER trg_set_scheduled_message_organization
BEFORE INSERT ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.set_scheduled_message_organization();

-- 3) Atualizar política de INSERT para validar pela organização do lead
DROP POLICY IF EXISTS "Users can create organization scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users can create scheduled messages in their organization" ON public.scheduled_messages;

CREATE POLICY "Users can create scheduled messages for leads in their org"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = lead_id
      AND l.organization_id = get_user_organization(auth.uid())
  )
);

-- 4) Manter políticas de SELECT/UPDATE/DELETE por organização
-- (não alteramos as existentes que já restringem por organization_id)