-- Tabela para notificações de desconexão de instâncias WhatsApp
CREATE TABLE IF NOT EXISTS public.instance_disconnection_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  qr_code TEXT,
  qr_code_fetched_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  whatsapp_notification_sent_at TIMESTAMPTZ,
  whatsapp_notification_to TEXT, -- Telefone para onde foi enviada a notificação
  resolved_at TIMESTAMPTZ, -- Quando a instância foi reconectada
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_org ON public.instance_disconnection_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_instance ON public.instance_disconnection_notifications(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_resolved ON public.instance_disconnection_notifications(resolved_at) 
  WHERE resolved_at IS NULL;

-- Habilitar RLS
ALTER TABLE public.instance_disconnection_notifications ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view disconnection notifications of their organization"
ON public.instance_disconnection_notifications
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Service can insert disconnection notifications"
ON public.instance_disconnection_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update disconnection notifications of their organization"
ON public.instance_disconnection_notifications
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_instance_disconnection_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_instance_disconnection_notifications_updated_at
BEFORE UPDATE ON public.instance_disconnection_notifications
FOR EACH ROW
EXECUTE FUNCTION update_instance_disconnection_notifications_updated_at();


