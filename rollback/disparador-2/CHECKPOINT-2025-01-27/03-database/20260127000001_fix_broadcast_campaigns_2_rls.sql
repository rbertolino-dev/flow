-- ============================================
-- Corrigir Políticas RLS de broadcast_campaigns_2
-- ============================================
-- As políticas atuais usam user_id, mas devem usar organization_id
-- para permitir que membros da organização vejam campanhas da organização
-- ============================================

-- Verificar se tabelas existem antes de corrigir políticas
DO $$
BEGIN
  -- Se tabelas não existem, criar primeiro
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'broadcast_campaigns_2'
  ) THEN
    RAISE EXCEPTION 'Tabela broadcast_campaigns_2 não existe. Execute primeiro a migration 20260129000001_create_broadcast_system_2.sql';
  END IF;
END $$;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can create their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can update their own campaigns 2" ON public.broadcast_campaigns_2;
DROP POLICY IF EXISTS "Users can delete their own campaigns 2" ON public.broadcast_campaigns_2;

-- Criar políticas corretas usando user_belongs_to_org (igual ao original)
CREATE POLICY "Users can view campaigns from their org 2"
ON public.broadcast_campaigns_2
FOR SELECT
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create campaigns for their org 2"
ON public.broadcast_campaigns_2
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update campaigns from their org 2"
ON public.broadcast_campaigns_2
FOR UPDATE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete campaigns from their org 2"
ON public.broadcast_campaigns_2
FOR DELETE
TO authenticated
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

-- Remover política de DELETE antiga (já substituída acima)
DROP POLICY IF EXISTS "broadcast_campaigns_2_delete_org_members" ON public.broadcast_campaigns_2;

-- Corrigir políticas RLS de broadcast_queue_2 também
DROP POLICY IF EXISTS "Users can view queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can insert queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can update queue of their campaigns 2" ON public.broadcast_queue_2;
DROP POLICY IF EXISTS "Users can delete queue of their campaigns 2" ON public.broadcast_queue_2;

-- Criar políticas corretas para broadcast_queue_2 usando organization_id
CREATE POLICY "Users can view queue of their org campaigns 2"
ON public.broadcast_queue_2
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can insert queue of their org campaigns 2"
ON public.broadcast_queue_2
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can update queue of their org campaigns 2"
ON public.broadcast_queue_2
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);

CREATE POLICY "Users can delete queue of their org campaigns 2"
ON public.broadcast_queue_2
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.broadcast_campaigns_2
    WHERE broadcast_campaigns_2.id = broadcast_queue_2.campaign_id
    AND (
      public.user_belongs_to_org(auth.uid(), broadcast_campaigns_2.organization_id)
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
);
