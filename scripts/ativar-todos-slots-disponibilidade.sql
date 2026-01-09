-- Script: Ativar Todos os Slots de Disponibilidade Inativos
-- ATENÇÃO: Este script ativa TODOS os slots inativos de TODAS as organizações
-- Use com cuidado!

-- 1. Ver quantos slots serão ativados ANTES de executar
SELECT 
  COUNT(*) as slots_que_serao_ativados,
  COUNT(DISTINCT organization_id) as organizacoes_afetadas
FROM public.user_availability_slots
WHERE is_active = false;

-- 2. Ativar todos os slots inativos
UPDATE public.user_availability_slots
SET 
  is_active = true,
  updated_at = now()
WHERE is_active = false;

-- 3. Verificar resultado
SELECT 
  o.name as organizacao,
  COUNT(*) FILTER (WHERE uas.is_active = true) as slots_ativos,
  COUNT(*) FILTER (WHERE uas.is_active = false) as slots_inativos
FROM public.user_availability_slots uas
JOIN public.organizations o ON o.id = uas.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;

