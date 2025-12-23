-- Add an INSERT policy for evolution_config so org members can create instances
-- Keeps RLS secure while allowing legitimate inserts

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert configs for their own organization,
-- and only for themselves as the owner of the row
CREATE POLICY insert_evolution_config_members
ON public.evolution_config
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
  AND public.user_belongs_to_org(auth.uid(), organization_id)
);
