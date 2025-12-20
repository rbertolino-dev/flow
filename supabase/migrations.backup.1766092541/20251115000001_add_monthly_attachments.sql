-- Migração: Adicionar suporte a anexos por mês de cobrança
-- Permite múltiplos anexos por contato (um por mês de referência)

-- Adicionar campo month_reference na tabela de anexos por contato
ALTER TABLE public.whatsapp_workflow_contact_attachments
  ADD COLUMN IF NOT EXISTS month_reference text;

-- Remover constraint UNIQUE antiga (workflow_id, lead_id, contact_phone)
-- Primeiro, verificar se existe e remover
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key'
  ) THEN
    ALTER TABLE public.whatsapp_workflow_contact_attachments
      DROP CONSTRAINT whatsapp_workflow_contact_attachments_workflow_id_lead_id_contact_phone_key;
  END IF;
END $$;

-- Criar novo índice UNIQUE incluindo month_reference
-- Permite múltiplos anexos por contato, mas apenas um por mês
-- Usar expressão para tratar NULL como string vazia
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_unique
  ON public.whatsapp_workflow_contact_attachments (
    workflow_id, 
    lead_id, 
    contact_phone, 
    COALESCE(month_reference, '')
  );

-- Índice para busca por mês de referência
CREATE INDEX IF NOT EXISTS idx_whatsapp_workflow_contact_attachments_month
  ON public.whatsapp_workflow_contact_attachments (workflow_id, lead_id, month_reference)
  WHERE month_reference IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_workflow_contact_attachments.month_reference IS 
  'Referência do mês no formato MM/YYYY (ex: 01/2025). Permite múltiplos anexos por contato, um por mês. NULL para anexos gerais (não específicos de mês).';

