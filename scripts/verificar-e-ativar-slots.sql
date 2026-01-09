-- ============================================
-- Script: Verificar e Ativar Slots de Disponibilidade
-- ============================================
-- Este script mostra todos os slots e permite ativar os inativos
-- Execute cada seção separadamente no Supabase SQL Editor

-- ============================================
-- SEÇÃO 1: Ver TODOS os slots (ativos e inativos)
-- ============================================
SELECT 
  o.name as "Organização",
  p.email as "Usuário",
  CASE uas.day_of_week
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda-feira'
    WHEN 2 THEN 'Terça-feira'
    WHEN 3 THEN 'Quarta-feira'
    WHEN 4 THEN 'Quinta-feira'
    WHEN 5 THEN 'Sexta-feira'
    WHEN 6 THEN 'Sábado'
  END as "Dia da Semana",
  uas.start_time as "Início",
  uas.end_time as "Fim",
  CASE 
    WHEN uas.is_active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as "Status"
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
JOIN public.profiles p ON p.id = uas.user_id
ORDER BY o.name, uas.day_of_week, uas.start_time;

-- ============================================
-- SEÇÃO 2: Resumo por Organização
-- ============================================
SELECT 
  o.name as "Organização",
  COUNT(*) FILTER (WHERE uas.is_active = true) as "Slots Ativos",
  COUNT(*) FILTER (WHERE uas.is_active = false) as "Slots Inativos",
  COUNT(*) as "Total"
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;

-- ============================================
-- SEÇÃO 3: Ver APENAS slots INATIVOS
-- ============================================
SELECT 
  o.name as "Organização",
  p.email as "Usuário",
  CASE uas.day_of_week
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda-feira'
    WHEN 2 THEN 'Terça-feira'
    WHEN 3 THEN 'Quarta-feira'
    WHEN 4 THEN 'Quinta-feira'
    WHEN 5 THEN 'Sexta-feira'
    WHEN 6 THEN 'Sábado'
  END as "Dia da Semana",
  uas.start_time as "Início",
  uas.end_time as "Fim",
  uas.id as "ID do Slot"
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
JOIN public.profiles p ON p.id = uas.user_id
WHERE uas.is_active = false
ORDER BY o.name, uas.day_of_week, uas.start_time;

-- ============================================
-- SEÇÃO 4: ATIVAR TODOS os slots inativos
-- ============================================
-- ⚠️ ATENÇÃO: Esta query ativa TODOS os slots inativos de TODAS as organizações
-- Execute apenas se quiser ativar tudo de uma vez

-- Primeiro, veja quantos serão ativados:
SELECT COUNT(*) as "Slots que serão ativados"
FROM public.user_availability_slots
WHERE is_active = false;

-- Depois, execute para ativar:
-- UPDATE public.user_availability_slots
-- SET 
--   is_active = true,
--   updated_at = now()
-- WHERE is_active = false;

-- ============================================
-- SEÇÃO 5: Ativar slots de UMA organização específica
-- ============================================
-- Primeiro, encontre o ID da sua organização:
SELECT 
  id,
  name as "Nome",
  slug
FROM public.organizations
ORDER BY name;

-- Depois, substitua 'AQUI_VAI_O_ID' pelo ID encontrado e execute:
-- UPDATE public.user_availability_slots
-- SET 
--   is_active = true,
--   updated_at = now()
-- WHERE organization_id = 'AQUI_VAI_O_ID'::uuid
--   AND is_active = false;

