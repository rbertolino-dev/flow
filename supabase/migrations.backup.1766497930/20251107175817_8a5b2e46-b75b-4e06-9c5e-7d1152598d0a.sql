-- Make default pipeline stages creation idempotent to prevent unique constraint violations during user creation
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_org_id UUID;
BEGIN
  -- Obter organização do usuário
  SELECT organization_id INTO user_org_id
  FROM public.organization_members
  WHERE user_id = NEW.id
  LIMIT 1;

  -- Criar estágios padrão do funil (idempotente)
  INSERT INTO public.pipeline_stages (user_id, organization_id, name, color, position)
  VALUES
    (NEW.id, user_org_id, 'Novo Lead', '#10b981', 0),
    (NEW.id, user_org_id, 'Contato Feito', '#3b82f6', 1),
    (NEW.id, user_org_id, 'Proposta Enviada', '#8b5cf6', 2),
    (NEW.id, user_org_id, 'Em Negociação', '#f59e0b', 3),
    (NEW.id, user_org_id, 'Ganho', '#22c55e', 4),
    (NEW.id, user_org_id, 'Perdido', '#ef4444', 5)
  ON CONFLICT (user_id, name) DO NOTHING;

  RETURN NEW;
END;
$function$;