-- Campos do painel de organizações no super admin e operações restritas a admin.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS vigencia_ends_at date;

CREATE OR REPLACE FUNCTION public.superadmin_assert()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR public.is_pubdigital_user(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_org_meta()
RETURNS TABLE (
  id uuid,
  is_active boolean,
  admin_notes text,
  vigencia_ends_at date,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.superadmin_assert();

  RETURN QUERY
  SELECT o.id, o.is_active, o.admin_notes, o.vigencia_ends_at, o.updated_at
  FROM public.organizations o;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_update_org_meta(
  _org_id uuid,
  _name text DEFAULT NULL,
  _is_active boolean DEFAULT NULL,
  _admin_notes text DEFAULT NULL,
  _set_notes boolean DEFAULT false,
  _vigencia date DEFAULT NULL,
  _set_vigencia boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.superadmin_assert();

  UPDATE public.organizations
  SET
    name = COALESCE(NULLIF(btrim(_name), ''), name),
    is_active = COALESCE(_is_active, is_active),
    admin_notes = CASE WHEN _set_notes THEN _admin_notes ELSE admin_notes END,
    vigencia_ends_at = CASE WHEN _set_vigencia THEN _vigencia ELSE vigencia_ends_at END,
    updated_at = now()
  WHERE id = _org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organização não encontrada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_purge_financial_entries(
  _org_id uuid,
  _direction text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  PERFORM public.superadmin_assert();

  IF _direction NOT IN ('receber', 'pagar') THEN
    RAISE EXCEPTION 'Direção inválida';
  END IF;

  UPDATE public.financial_entries
  SET covered_by_entry_id = NULL
  WHERE organization_id = _org_id
    AND direction = _direction
    AND covered_by_entry_id IS NOT NULL;

  DELETE FROM public.financial_entries
  WHERE organization_id = _org_id
    AND direction = _direction;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_list_org_meta() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_update_org_meta(uuid, text, boolean, text, boolean, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_purge_financial_entries(uuid, text) TO authenticated;
