-- ============================================
-- FIX: Garantir que função delete_user_from_organization existe
-- ============================================
-- Esta migration garante que a função delete_user_from_organization
-- e sua dependência transfer_user_data_to_admin existam no banco

-- ============================================
-- 1. Função para transferir dados do usuário para admin
-- ============================================
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

  -- Transferir activities (se tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities') THEN
    UPDATE public.activities
    SET user_name = (SELECT full_name FROM profiles WHERE id = _admin_id)
    WHERE lead_id IN (
      SELECT id FROM leads WHERE organization_id = _org_id
    );
  END IF;

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

-- ============================================
-- 2. Função para excluir usuário de organização
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_user_from_organization(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  refs_exist boolean;
BEGIN
  -- Transferir dados primeiro
  PERFORM public.transfer_user_data_to_admin(_user_id, _org_id);

  -- Remover o usuário da organização
  DELETE FROM public.organization_members
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- Se o usuário ainda pertence a alguma organização, não tentar apagar perfil/auth
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id) THEN
    RETURN;
  END IF;

  -- Verificar se ainda existem referências em tabelas principais
  SELECT EXISTS (
    SELECT 1 FROM public.leads WHERE user_id = _user_id OR created_by = _user_id OR updated_by = _user_id
    UNION ALL
    SELECT 1 FROM public.call_queue WHERE created_by = _user_id OR updated_by = _user_id
    UNION ALL
    SELECT 1 FROM public.scheduled_messages WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.message_templates WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.broadcast_campaigns WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.tags WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.pipeline_stages WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.evolution_config WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.whatsapp_lid_contacts WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.international_contacts WHERE user_id = _user_id
    UNION ALL
    SELECT 1 FROM public.whatsapp_messages WHERE user_id = _user_id
  ) INTO refs_exist;

  -- Se ainda houver referências, não apagar o perfil para evitar erro de FK
  IF refs_exist THEN
    RETURN; -- Consideramos concluído: removido da org e dados transferidos
  END IF;

  -- Somente agora, sem referências e sem organizações, apagar perfil e auth
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- ============================================
-- 3. Garantir permissões corretas
-- ============================================
-- As funções já são SECURITY DEFINER, então executam com privilégios do criador
-- Garantir que usuários autenticados possam executar
GRANT EXECUTE ON FUNCTION public.transfer_user_data_to_admin(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_from_organization(UUID, UUID) TO authenticated;

