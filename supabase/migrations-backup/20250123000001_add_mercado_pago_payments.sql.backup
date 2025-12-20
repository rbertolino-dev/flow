-- Migração: Tabela para rastreamento de pagamentos do Mercado Pago
-- Permite armazenar e gerenciar links de pagamento gerados via Mercado Pago

CREATE TABLE IF NOT EXISTS public.mercado_pago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Mercado Pago
  mercado_pago_preference_id text NOT NULL UNIQUE,
  mercado_pago_payment_id text, -- Preenchido quando pagamento é confirmado
  
  -- Informações do pagamento
  valor decimal(10, 2) NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- Dados do comprador
  payer_name text,
  payer_email text,
  payer_phone text,
  payer_cpf_cnpj text,
  
  -- URLs e links
  payment_link text NOT NULL, -- init_point da preferência
  sandbox_init_point text, -- Para ambiente sandbox
  
  -- Status do pagamento
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  status_detail text,
  
  -- Dados financeiros
  valor_pago decimal(10, 2),
  data_pagamento timestamptz,
  metodo_pagamento text, -- credit_card, debit_card, ticket, pix, etc
  
  -- Auditoria
  criado_por uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_org
  ON public.mercado_pago_payments (organization_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_lead
  ON public.mercado_pago_payments (lead_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_workflow
  ON public.mercado_pago_payments (workflow_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_preference_id
  ON public.mercado_pago_payments (mercado_pago_preference_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_payment_id
  ON public.mercado_pago_payments (mercado_pago_payment_id);
CREATE INDEX IF NOT EXISTS idx_mercado_pago_payments_status
  ON public.mercado_pago_payments (status);

-- RLS
ALTER TABLE public.mercado_pago_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mercado Pago payments: members can select"
  ON public.mercado_pago_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can insert"
  ON public.mercado_pago_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Mercado Pago payments: members can update"
  ON public.mercado_pago_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mercado_pago_payments.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), mercado_pago_payments.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_mercado_pago_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mercado_pago_payments_updated_at
  BEFORE UPDATE ON public.mercado_pago_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mercado_pago_payments_updated_at();

