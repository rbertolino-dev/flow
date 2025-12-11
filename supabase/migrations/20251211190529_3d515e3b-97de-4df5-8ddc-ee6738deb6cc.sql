-- ============================================
-- Migration: Add missing tables and columns
-- ============================================

-- 1. Tabela assistant_config para configurações do assistente DeepSeek
CREATE TABLE IF NOT EXISTS public.assistant_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    system_prompt TEXT,
    tone_of_voice TEXT DEFAULT 'profissional',
    rules TEXT,
    restrictions TEXT,
    examples TEXT,
    temperature NUMERIC DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    model TEXT DEFAULT 'deepseek-chat',
    is_active BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para assistant_config
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all assistant config"
ON public.assistant_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can view their org assistant config"
ON public.assistant_config
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) OR is_global = true);

-- 2. Tabela instance_disconnection_notifications para alertas de desconexão
CREATE TABLE IF NOT EXISTS public.instance_disconnection_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    instance_id UUID NOT NULL REFERENCES public.evolution_config(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    qr_code TEXT,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    whatsapp_notification_sent_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS para instance_disconnection_notifications
ALTER TABLE public.instance_disconnection_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org notifications"
ON public.instance_disconnection_notifications
FOR SELECT
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can insert their org notifications"
ON public.instance_disconnection_notifications
FOR INSERT
WITH CHECK (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can update their org notifications"
ON public.instance_disconnection_notifications
FOR UPDATE
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can delete their org notifications"
ON public.instance_disconnection_notifications
FOR DELETE
USING (organization_id = get_user_organization(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Índices para instance_disconnection_notifications
CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_instance_id 
ON public.instance_disconnection_notifications(instance_id);

CREATE INDEX IF NOT EXISTS idx_instance_disconnection_notifications_org_id 
ON public.instance_disconnection_notifications(organization_id);

-- 3. Adicionar colunas status, completed_at, completion_notes em calendar_events
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_assistant_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_assistant_config_updated_at ON public.assistant_config;
CREATE TRIGGER update_assistant_config_updated_at
BEFORE UPDATE ON public.assistant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_assistant_config_updated_at();

CREATE OR REPLACE FUNCTION public.update_instance_disconnection_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_instance_disconnection_notifications_updated_at ON public.instance_disconnection_notifications;
CREATE TRIGGER update_instance_disconnection_notifications_updated_at
BEFORE UPDATE ON public.instance_disconnection_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_instance_disconnection_notifications_updated_at();