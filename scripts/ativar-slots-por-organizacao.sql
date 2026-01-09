-- Script: Ativar Slots de Disponibilidade de uma Organização Específica
-- 
-- INSTRUÇÕES:
-- 1. Primeiro, execute a query abaixo para encontrar o ID da sua organização
-- 2. Depois, substitua 'SEU_ORGANIZATION_ID_AQUI' pelo ID encontrado
-- 3. Execute a query de UPDATE

-- PASSO 1: Encontrar o ID da sua organização
-- Procure pelo nome da sua organização na lista abaixo
SELECT 
  id,
  name as nome_organizacao,
  slug
FROM public.organizations
ORDER BY name;

-- PASSO 2: Ver slots inativos da organização (substitua o ID)
SELECT 
  uas.id,
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
  uas.is_active,
  p.email as usuario_email
FROM public.user_availability_slots uas
JOIN public.profiles p ON p.id = uas.user_id
WHERE uas.organization_id = 'SEU_ORGANIZATION_ID_AQUI'  -- ⚠️ SUBSTITUA AQUI
  AND uas.is_active = false
ORDER BY uas.day_of_week, uas.start_time;

-- PASSO 3: Ativar slots inativos da organização (substitua o ID)
UPDATE public.user_availability_slots
SET 
  is_active = true,
  updated_at = now()
WHERE organization_id = 'SEU_ORGANIZATION_ID_AQUI'  -- ⚠️ SUBSTITUA AQUI
  AND is_active = false;

-- PASSO 4: Verificar resultado
SELECT 
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
  END as status
FROM public.user_availability_slots uas
WHERE uas.organization_id = 'SEU_ORGANIZATION_ID_AQUI'  -- ⚠️ SUBSTITUA AQUI
ORDER BY uas.day_of_week, uas.start_time;

