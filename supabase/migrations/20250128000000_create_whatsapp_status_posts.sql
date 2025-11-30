-- Tabela para agendamento e publicação de status do WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_status_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_whatsapp_status_posts_org ON public.whatsapp_status_posts(organization_id);
CREATE INDEX idx_whatsapp_status_posts_instance ON public.whatsapp_status_posts(instance_id);
CREATE INDEX idx_whatsapp_status_posts_status ON public.whatsapp_status_posts(status);
CREATE INDEX idx_whatsapp_status_posts_scheduled ON public.whatsapp_status_posts(scheduled_for) 
  WHERE status = 'pending';

-- Habilitar RLS
ALTER TABLE public.whatsapp_status_posts ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view status posts of their organization"
ON public.whatsapp_status_posts
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create status posts for their organization"
ON public.whatsapp_status_posts
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update status posts of their organization"
ON public.whatsapp_status_posts
FOR UPDATE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete status posts of their organization"
ON public.whatsapp_status_posts
FOR DELETE
USING (
  organization_id = get_user_organization(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_status_posts_updated_at
BEFORE UPDATE ON public.whatsapp_status_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

