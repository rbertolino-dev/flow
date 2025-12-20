-- Script para verificar e gerar slugs para pesquisas que não têm
-- Execute este script no Supabase SQL Editor

-- 1. Verificar quantas pesquisas não têm slug
SELECT 
  COUNT(*) as total_pesquisas,
  COUNT(public_slug) as com_slug,
  COUNT(*) - COUNT(public_slug) as sem_slug
FROM public.surveys;

-- 2. Ver pesquisas sem slug
SELECT 
  id, 
  name, 
  public_slug,
  is_active,
  created_at
FROM public.surveys
WHERE public_slug IS NULL OR public_slug = ''
ORDER BY created_at DESC;

-- 3. Gerar slugs para pesquisas que não têm
UPDATE public.surveys
SET public_slug = generate_survey_slug()
WHERE public_slug IS NULL OR public_slug = '';

-- 4. Verificar resultado
SELECT 
  id, 
  name, 
  public_slug, 
  is_active,
  created_at
FROM public.surveys
ORDER BY created_at DESC
LIMIT 10;





