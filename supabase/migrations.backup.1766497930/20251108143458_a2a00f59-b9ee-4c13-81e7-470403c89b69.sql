-- Função para transferir ownership de todos os dados de um usuário para o admin da org
CREATE OR REPLACE FUNCTION public.transfer_user_data_to_admin(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id UUID;
BEGIN
  -- Buscar o primeiro admin/owner da organização
  SELECT user_id INTO _admin_id
  FROM public.organization_members
  WHERE organization_id = _org_id
    AND role IN ('owner', 'admin')
  ORDER BY 
    CASE role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
    END
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum administrador encontrado na organização';
  END IF;

  -- Transferir leads
  UPDATE public.leads
  SET user_id = _admin_id, 
      updated_by = _admin_id,
      updated_at = now()
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir activities
  UPDATE public.activities
  SET user_name = (SELECT full_name FROM profiles WHERE id = _admin_id)
  WHERE lead_id IN (
    SELECT id FROM leads WHERE organization_id = _org_id
  );

  -- Transferir call_queue
  UPDATE public.call_queue
  SET created_by = _admin_id,
      updated_by = _admin_id
  WHERE created_by = _user_id
    AND organization_id = _org_id;

  -- Transferir scheduled_messages
  UPDATE public.scheduled_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir message_templates
  UPDATE public.message_templates
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir broadcast_campaigns
  UPDATE public.broadcast_campaigns
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir tags
  UPDATE public.tags
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir pipeline_stages
  UPDATE public.pipeline_stages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir evolution_config
  UPDATE public.evolution_config
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_lid_contacts
  UPDATE public.whatsapp_lid_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir international_contacts
  UPDATE public.international_contacts
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Transferir whatsapp_messages
  UPDATE public.whatsapp_messages
  SET user_id = _admin_id
  WHERE user_id = _user_id
    AND organization_id = _org_id;
END;
$$;

-- Função para excluir usuário de uma organização
CREATE OR REPLACE FUNCTION public.delete_user_from_organization(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Primeiro transferir todos os dados
  PERFORM public.transfer_user_data_to_admin(_user_id, _org_id);

  -- Remover o usuário da organização
  DELETE FROM public.organization_members
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Se o usuário não pertence a nenhuma organização, deletar profile e auth
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members WHERE user_id = _user_id
  ) THEN
    -- Deletar profile (auth será deletado em cascata se configurado)
    DELETE FROM public.profiles WHERE id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  END IF;
END;
$$;