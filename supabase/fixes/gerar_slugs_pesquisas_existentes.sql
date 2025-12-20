-- Script para gerar slugs para pesquisas existentes que não têm
-- Execute este script no Supabase SQL Editor

-- Verificar quantas pesquisas não têm slug
SELECT COUNT(*) as pesquisas_sem_slug
FROM public.surveys
WHERE public_slug IS NULL OR public_slug = '';

-- Gerar slugs para todas as pesquisas que não têm
UPDATE public.surveys
SET public_slug = generate_survey_slug()
WHERE public_slug IS NULL OR public_slug = '';

-- Verificar resultado
SELECT id, name, public_slug, created_at
FROM public.surveys
ORDER BY created_at DESC
LIMIT 10;





