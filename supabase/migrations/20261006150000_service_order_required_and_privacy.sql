-- Campos obrigatórios do modelo e privacidade das ordens de serviço.
-- Administrador e dono veem todas. Os demais só veem ordens em que são colaborador ou responsável.

UPDATE public.service_order_template_fields
SET
  is_required = true,
  is_visible = true,
  label = CASE
    WHEN field_key = 'starts_at' THEN 'Previsão da execução'
    ELSE label
  END
WHERE field_key IN ('responsible_name', 'collaborator_name', 'service_name', 'starts_at');

CREATE OR REPLACE FUNCTION public.can_access_service_order(
  p_organization_id uuid,
  p_collaborator_user_id uuid,
  p_responsible_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      EXISTS (
        SELECT 1
        FROM public.organization_members m
        WHERE m.organization_id = p_organization_id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
      )
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_members m
        WHERE m.organization_id = p_organization_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin')
      )
      OR p_collaborator_user_id = auth.uid()
      OR p_responsible_user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_service_order(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_service_order(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS service_orders_select ON public.service_orders;
CREATE POLICY service_orders_select ON public.service_orders
  FOR SELECT USING (
    public.can_access_service_order(organization_id, collaborator_user_id, responsible_user_id)
  );

DROP POLICY IF EXISTS service_orders_update ON public.service_orders;
CREATE POLICY service_orders_update ON public.service_orders
  FOR UPDATE
  USING (
    public.can_access_service_order(organization_id, collaborator_user_id, responsible_user_id)
  )
  WITH CHECK (
    public.can_access_service_order(organization_id, collaborator_user_id, responsible_user_id)
  );

DROP POLICY IF EXISTS service_orders_delete ON public.service_orders;
CREATE POLICY service_orders_delete ON public.service_orders
  FOR DELETE USING (
    public.can_access_service_order(organization_id, collaborator_user_id, responsible_user_id)
  );
