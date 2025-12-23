-- ============================================
-- MIGRAÇÃO: Tabela de Boletos WhatsApp
-- ============================================

-- Criar tabela whatsapp_boletos
CREATE TABLE IF NOT EXISTS public.whatsapp_boletos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES public.whatsapp_workflows(id) ON DELETE SET NULL,
  scheduled_message_id uuid REFERENCES public.scheduled_messages(id) ON DELETE SET NULL,
  
  -- Dados do Asaas
  asaas_payment_id text NOT NULL,
  asaas_customer_id text NOT NULL,
  
  -- Dados do boleto
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  descricao text,
  referencia_externa text,
  
  -- URLs e códigos
  boleto_url text,
  boleto_pdf_url text,
  linha_digitavel text,
  codigo_barras text,
  nosso_numero text,
  
  -- Status
  status text NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_org 
  ON public.whatsapp_boletos(organization_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_lead 
  ON public.whatsapp_boletos(lead_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_asaas_payment 
  ON public.whatsapp_boletos(asaas_payment_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_boletos_status 
  ON public.whatsapp_boletos(status);

-- Habilitar RLS
ALTER TABLE public.whatsapp_boletos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para whatsapp_boletos
CREATE POLICY "Boletos: members can select"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
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
      SELECT 1
      FROM public.organization_members om
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
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

CREATE POLICY "Boletos: members can delete"
  ON public.whatsapp_boletos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = whatsapp_boletos.organization_id
        AND om.user_id = auth.uid()
    )
    OR public.user_is_org_admin(auth.uid(), whatsapp_boletos.organization_id)
    OR public.is_pubdigital_user(auth.uid())
  );

-- Super admins podem ver todos os boletos
CREATE POLICY "Super admins can view all boletos"
  ON public.whatsapp_boletos
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.is_pubdigital_user(auth.uid())
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_boletos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_whatsapp_boletos_updated_at
  BEFORE UPDATE ON public.whatsapp_boletos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_whatsapp_boletos_updated_at();

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================