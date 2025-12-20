-- ============================================
-- Migração: Sistema de Auditoria Completa para Contratos
-- ============================================

-- Tabela de log de auditoria de contratos
CREATE TABLE IF NOT EXISTS public.contract_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'sent', 'signed', 'cancelled', 
    'expired', 'viewed', 'downloaded', 'pdf_generated', 'reminder_sent',
    'category_changed', 'status_changed', 'expiration_warning', 'unsigned_reminder'
  )),
  details JSONB DEFAULT '{}'::jsonb,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_contract ON public.contract_audit_log(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_user ON public.contract_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_action ON public.contract_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_contract_audit_log_timestamp ON public.contract_audit_log(timestamp DESC);

-- Habilitar RLS
ALTER TABLE public.contract_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies para contract_audit_log
CREATE POLICY "Users can view audit logs of contracts in their organization"
ON public.contract_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_audit_log.contract_id
      AND om.user_id = auth.uid()
  )
);

-- Política para inserção (qualquer usuário autenticado pode criar logs)
CREATE POLICY "Authenticated users can create audit logs"
ON public.contract_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Comentários
COMMENT ON TABLE public.contract_audit_log IS 'Log completo de todas as ações realizadas em contratos para auditoria e compliance';
COMMENT ON COLUMN public.contract_audit_log.action IS 'Tipo de ação realizada: created, updated, deleted, sent, signed, cancelled, expired, viewed, downloaded, etc.';
COMMENT ON COLUMN public.contract_audit_log.details IS 'Detalhes adicionais da ação em formato JSON';
COMMENT ON COLUMN public.contract_audit_log.old_value IS 'Valor anterior (para ações de update)';
COMMENT ON COLUMN public.contract_audit_log.new_value IS 'Valor novo (para ações de update)';

