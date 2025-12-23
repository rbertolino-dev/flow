-- Migração: Tabela para rastreamento de boletos gerados
-- Permite armazenar e gerenciar boletos gerados via Asaas

CREATE TABLE IF NOT EXISTS public.whatsapp_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Asaas
  asaas_payment_id text NOT NULL UNIQUE,
  asaas_customer_id text NOT NULL,
  
  -- Informações do boleto
  valor decimal(10, 2) NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- URLs e dados do boleto
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'paid', 'cancelled', 'overdue', 'refunded')),
  data_pagamento date,
  valor_pago decimal(10, 2),
  
  -- Auditoria
  criado_por uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_org
  ON public.whatsapp_boletos (organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_lead
  ON public.whatsapp_boletos (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_workflow
  ON public.whatsapp_boletos (workflow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_asaas_payment_id
  ON public.whatsapp_boletos (asaas_payment_id);

-- RLS
ALTER TABLE public.whatsapp_boletos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boletos: members can select"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can insert"
  ON public.whatsapp_boletos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can update"
  ON public.whatsapp_boletos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_boletos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_boletos_updated_at
  BEFORE UPDATE ON public.whatsapp_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_boletos_updated_at();

