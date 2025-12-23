-- ============================================
-- Migração: Sistema de Lembretes Automáticos para Contratos
-- ============================================

-- Tabela de lembretes de contratos
CREATE TABLE IF NOT EXISTS public.contract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('signature_due', 'expiration_approaching', 'follow_up', 'custom', 'expiration_warning', 'unsigned_reminder')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  message TEXT,
  sent_via TEXT CHECK (sent_via IN ('whatsapp', 'email', 'sms', 'system', 'both')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_reminders_contract ON public.contract_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_reminders_scheduled ON public.contract_reminders(scheduled_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contract_reminders_type ON public.contract_reminders(reminder_type);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contract_reminders_updated_at
BEFORE UPDATE ON public.contract_reminders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.contract_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contract_reminders
CREATE POLICY "Users can view reminders of contracts in their organization"
ON public.contract_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create reminders for contracts in their organization"
ON public.contract_reminders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update reminders of contracts in their organization"
ON public.contract_reminders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete reminders of contracts in their organization"
ON public.contract_reminders FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_reminders.contract_id
      AND om.user_id = auth.uid()
  )
);

-- Comentários
COMMENT ON TABLE public.contract_reminders IS 'Lembretes automáticos para contratos (vencimento, não assinados, etc.)';
COMMENT ON COLUMN public.contract_reminders.reminder_type IS 'Tipo de lembrete: expiration_warning (aviso de vencimento), unsigned_reminder (não assinado), custom (personalizado)';
COMMENT ON COLUMN public.contract_reminders.scheduled_at IS 'Data/hora agendada para envio do lembrete';
COMMENT ON COLUMN public.contract_reminders.sent_at IS 'Data/hora em que o lembrete foi enviado (null = pendente)';

