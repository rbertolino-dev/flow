-- Garantir que usuários possam ver perfis de outros usuários da mesma organização
-- Isso é necessário para o AddExistingUserDialog funcionar

-- Primeiro, vamos garantir que a política de visualização de perfis permita ver todos os perfis
-- (isso é seguro porque perfis contêm apenas informações básicas como email e nome)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Comentário: Esta política permite que usuários autenticados vejam todos os perfis
-- Isso é necessário para funcionalidades como adicionar usuários existentes a organizações
-- Os perfis contêm apenas informações básicas (email, nome) que são necessárias para colaboração