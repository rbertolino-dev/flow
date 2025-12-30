-- Criar tabela de logs de envio de contratos
CREATE TABLE IF NOT EXISTS public.contract_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  sent_via text NOT NULL CHECK (sent_via IN ('whatsapp', 'email')),
  recipient_phone text,
  recipient_email text,
  download_link text NOT NULL,
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz NOT NULL DEFAULT now(),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_contract_send_logs_contract ON public.contract_send_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_send_logs_sent_by ON public.contract_send_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_contract_send_logs_sent_at ON public.contract_send_logs(sent_at);

-- Habilitar RLS
ALTER TABLE public.contract_send_logs ENABLE ROW LEVEL SECURITY;

-- Policies para contract_send_logs
DROP POLICY IF EXISTS "Users can view send logs for their org contracts" ON public.contract_send_logs;
CREATE POLICY "Users can view send logs for their org contracts"
  ON public.contract_send_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_send_logs.contract_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create send logs for their org contracts" ON public.contract_send_logs;
CREATE POLICY "Users can create send logs for their org contracts"
  ON public.contract_send_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = contract_send_logs.contract_id
        AND om.user_id = auth.uid()
    )
  );

-- Comentários
COMMENT ON TABLE public.contract_send_logs IS 'Logs de envio de contratos assinados';
COMMENT ON COLUMN public.contract_send_logs.sent_via IS 'Método de envio: whatsapp ou email';
COMMENT ON COLUMN public.contract_send_logs.download_link IS 'Link permanente para download do contrato';
COMMENT ON COLUMN public.contract_send_logs.error_message IS 'Mensagem de erro se o envio falhar';

