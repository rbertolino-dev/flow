-- Adicionar política para super admins poderem atualizar organizações
CREATE POLICY "Super admins can update organizations" 
ON public.organizations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));