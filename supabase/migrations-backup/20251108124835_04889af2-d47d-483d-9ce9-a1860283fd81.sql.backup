-- Finalizar configuração de scheduled_messages

-- Tornar organization_id NOT NULL (se ainda não for)
DO $$ 
BEGIN
  ALTER TABLE public.scheduled_messages 
  ALTER COLUMN organization_id SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_organization_id 
ON public.scheduled_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead_id 
ON public.scheduled_messages(lead_id);

COMMENT ON COLUMN public.scheduled_messages.organization_id IS 'ID da organização à qual a mensagem agendada pertence';