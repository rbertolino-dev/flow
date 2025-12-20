-- Adicionar política RLS pública para permitir acesso a pesquisas ativas via public_slug
-- Execute este SQL no Supabase SQL Editor

-- Política para permitir acesso público a pesquisas ativas
DROP POLICY IF EXISTS "Public can view active surveys by slug" ON public.surveys;
CREATE POLICY "Public can view active surveys by slug"
  ON public.surveys FOR SELECT
  USING (
    is_active = true
    AND public_slug IS NOT NULL
    AND public_slug != ''
  );

-- Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'surveys'
ORDER BY policyname;





