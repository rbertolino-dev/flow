-- 1) Adicionar organization_id em evolution_logs para isolamento correto
ALTER TABLE public.evolution_logs 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_evolution_logs_organization 
ON public.evolution_logs(organization_id);

-- 2) Atualizar políticas RLS de evolution_logs para usar organization_id
DROP POLICY IF EXISTS "Users can insert their own evolution logs" ON public.evolution_logs;
DROP POLICY IF EXISTS "Users can view their own evolution logs" ON public.evolution_logs;

CREATE POLICY "Users can insert organization evolution logs"
ON public.evolution_logs
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can view organization evolution logs"
ON public.evolution_logs
FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all evolution logs"
ON public.evolution_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 3) Garantir que activities acessa apenas leads da mesma org (já correto via leads)
-- Adicionar política super admin que faltava
CREATE POLICY "Super admins can delete activities"
ON public.activities
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can update activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 4) Verificar políticas de broadcast_queue para super admins
CREATE POLICY "Super admins can update broadcast queue"
ON public.broadcast_queue
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 5) Adicionar políticas super admin faltantes em call_queue_tags
CREATE POLICY "Super admins can update call queue tags"
ON public.call_queue_tags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 6) Adicionar políticas super admin faltantes em lead_tags
CREATE POLICY "Super admins can update lead tags"
ON public.lead_tags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

-- 7) Garantir que organizations pode ser inserida por super admins
CREATE POLICY "Super admins can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can delete organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin') OR is_pubdigital_user(auth.uid()));