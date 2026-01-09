-- Script: Verificar Slots de Disponibilidade
-- Este script verifica todos os slots de disponibilidade e mostra quais estão ativos/inativos

-- 1. Ver todos os slots de disponibilidade (com informações da organização e usuário)
SELECT 
  o.name as organizacao,
  o.id as organization_id,
  p.email as usuario_email,
  p.full_name as usuario_nome,
  CASE uas.day_of_week
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda-feira'
    WHEN 2 THEN 'Terça-feira'
    WHEN 3 THEN 'Quarta-feira'
    WHEN 4 THEN 'Quinta-feira'
    WHEN 5 THEN 'Sexta-feira'
    WHEN 6 THEN 'Sábado'
  END as dia_semana,
  uas.start_time as horario_inicio,
  uas.end_time as horario_fim,
  CASE 
    WHEN uas.is_active THEN '✅ ATIVO'
    ELSE '❌ INATIVO'
  END as status,
  uas.created_at as criado_em
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
JOIN public.profiles p ON p.id = uas.user_id
ORDER BY o.name, uas.day_of_week, uas.start_time;

-- 2. Resumo: Contar slots ativos vs inativos por organização
SELECT 
  o.name as organizacao,
  COUNT(*) FILTER (WHERE uas.is_active = true) as slots_ativos,
  COUNT(*) FILTER (WHERE uas.is_active = false) as slots_inativos,
  COUNT(*) as total_slots
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;

-- 3. Ver apenas slots INATIVOS (que precisam ser ativados)
SELECT 
  o.name as organizacao,
  p.email as usuario_email,
  CASE uas.day_of_week
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Segunda-feira'
    WHEN 2 THEN 'Terça-feira'
    WHEN 3 THEN 'Quarta-feira'
    WHEN 4 THEN 'Quinta-feira'
    WHEN 5 THEN 'Sexta-feira'
    WHEN 6 THEN 'Sábado'
  END as dia_semana,
  uas.start_time as horario_inicio,
  uas.end_time as horario_fim,
  uas.id as slot_id
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
JOIN public.profiles p ON p.id = uas.user_id
WHERE uas.is_active = false
ORDER BY o.name, uas.day_of_week, uas.start_time;

