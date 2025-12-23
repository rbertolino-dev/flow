-- Corrigir RLS policies da tabela activities para permitir inserção de atividades ao mover leads
DROP POLICY IF EXISTS "Users can insert organization activities" ON public.activities;

CREATE POLICY "Users can insert organization activities" 
ON public.activities 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR is_pubdigital_user(auth.uid())
);