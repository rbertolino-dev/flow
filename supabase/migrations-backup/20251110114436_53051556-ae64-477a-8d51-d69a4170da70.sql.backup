-- Tornar exclusão de perfil segura: só excluir quando não houver nenhuma referência restante
CREATE OR REPLACE FUNCTION public.delete_user_from_organization(_user_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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