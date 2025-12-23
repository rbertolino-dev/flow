-- Criar enum para as funcionalidades do sistema
CREATE TYPE public.app_permission AS ENUM (
  'view_leads',
  'create_leads',
  'edit_leads',
  'delete_leads',
  'view_call_queue',
  'manage_call_queue',
  'view_broadcast',
  'create_broadcast',
  'view_whatsapp',
  'send_whatsapp',
  'view_templates',
  'manage_templates',
  'view_pipeline',
  'manage_pipeline',
  'view_settings',
  'manage_settings',
  'manage_users',
  'view_reports'
);

-- Criar tabela de permissões dos usuários
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission app_permission NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, permission)
);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_permissions
CREATE POLICY "Admins can view all user permissions"
  ON public.user_permissions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all user permissions"
  ON public.user_permissions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Função para verificar se um usuário tem uma permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  )
$$;

-- Função para obter todas as permissões de um usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(permission app_permission)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT permission
  FROM public.user_permissions
  WHERE user_id = _user_id
$$;