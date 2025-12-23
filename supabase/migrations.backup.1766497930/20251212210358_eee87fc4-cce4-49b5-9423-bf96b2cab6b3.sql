-- Remover política existente e criar novas políticas completas para evolution_providers
DROP POLICY IF EXISTS "Super admins can manage evolution providers" ON public.evolution_providers;

-- Policy para SELECT
CREATE POLICY "Super admins can view evolution providers"
ON public.evolution_providers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para INSERT
CREATE POLICY "Super admins can create evolution providers"
ON public.evolution_providers
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para UPDATE
CREATE POLICY "Super admins can update evolution providers"
ON public.evolution_providers
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);

-- Policy para DELETE
CREATE POLICY "Super admins can delete evolution providers"
ON public.evolution_providers
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid())
);