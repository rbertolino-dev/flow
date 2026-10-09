-- Desvincula usuário de uma organização SEM apagar a conta (auth/profiles).
-- Uso: Super Admin move o usuário para outra empresa via "Adicionar existente" / criar de novo.

CREATE OR REPLACE FUNCTION public.unlink_user_from_organization(
  _user_id UUID,
  _org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas Super Admin pode desvincular usuários entre organizações';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta organização';
  END IF;

  -- Transferir leads/dados para um admin da mesma org, se a função existir
  IF to_regprocedure('public.transfer_user_data_to_admin(uuid,uuid)') IS NOT NULL THEN
    PERFORM public.transfer_user_data_to_admin(_user_id, _org_id);
  END IF;

  DELETE FROM public.user_permissions
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  DELETE FROM public.organization_members
  WHERE user_id = _user_id
    AND organization_id = _org_id;

  -- NÃO apaga profiles nem auth.users — a conta fica disponível para outra organização
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_user_from_organization(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.unlink_user_from_organization(UUID, UUID) IS
  'Remove o vínculo do usuário com a organização sem excluir a conta. Permite reutilizar o e-mail em outra empresa.';
