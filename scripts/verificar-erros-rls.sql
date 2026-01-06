-- =====================================================
-- Script para verificar erros de RLS e colunas faltantes
-- =====================================================

-- 1. Verificar se colunas de leads existem
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'leads'
  AND column_name IN ('has_unread_messages', 'last_message_at', 'unread_message_count')
ORDER BY column_name;

-- 2. Verificar políticas RLS de facebook_configs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'facebook_configs'
ORDER BY policyname;

-- 3. Verificar políticas RLS de evolution_logs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'evolution_logs'
ORDER BY policyname;

-- 4. Verificar se tabela evolution_logs existe e tem organization_id
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'evolution_logs'
  AND column_name = 'organization_id';

-- 5. Verificar se função increment_unread_count existe
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'increment_unread_count';

-- 6. Verificar se RLS está habilitado nas tabelas
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('facebook_configs', 'evolution_logs', 'leads')
ORDER BY tablename;

