-- ============================================
-- Script para Testar a Função get_organization_limits
-- ============================================

-- 1. Primeiro, vamos listar as organizações disponíveis
SELECT 
  id,
  name,
  created_at
FROM organizations
ORDER BY created_at DESC
LIMIT 10;

-- 2. Depois, escolha um ID da lista acima e teste a função:
-- (Substitua 'AQUI-VAI-O-UUID-DA-LISTA-ACIMA' pelo ID real)

-- Exemplo (use um UUID real da lista acima):
-- SELECT * FROM get_organization_limits('AQUI-VAI-O-UUID-DA-LISTA-ACIMA'::uuid);

-- 3. OU teste com a primeira organização encontrada automaticamente:
SELECT 
  o.id as organization_id,
  
  o.name as organization_name,
  r.*
FROM organizations o
CROSS JOIN LATERAL get_organization_limits(o.id) r
ORDER BY o.created_at DESC
LIMIT 5;

-- 4. Verificar se a função existe e está acessível:
SELECT 
  routine_name,
  routine_type,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_organization_limits';



