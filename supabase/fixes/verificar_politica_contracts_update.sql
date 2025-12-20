-- ============================================
-- VERIFICAR POLÍTICA "Allow update contract PDFs"
-- ============================================
-- Verificar se esta política é necessária ou redundante

-- Ver detalhes completos da política
SELECT 
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Allow update contract PDFs';

-- Comparar com a política geral de UPDATE
SELECT 
  policyname,
  cmd,
  roles,
  LEFT(qual, 200) AS using_expression,
  LEFT(with_check, 200) AS with_check_expression
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- Análise: A política "Allow update contract PDFs" é necessária?
-- 
-- Se ela tiver condições específicas para pasta contracts/ (ex: name LIKE '%/contracts/%'),
-- então ela é útil e deve ser mantida.
--
-- Se ela for genérica (sem condições de pasta), então é redundante com
-- "Authenticated users can update their workflow media" e pode ser removida.


