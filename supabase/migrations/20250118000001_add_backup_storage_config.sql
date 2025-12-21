-- ============================================
-- ADICIONAR CAMPOS DE BACKUP STORAGE
-- ============================================
-- Esta migration adiciona campos para configurar storage de backup
-- O storage principal sempre será Supabase (não muda)
-- O backup storage é opcional e configurável

-- Adicionar colunas de backup storage na tabela contract_storage_config
ALTER TABLE public.contract_storage_config
  ADD COLUMN IF NOT EXISTS backup_storage_type text CHECK (backup_storage_type IN ('supabase', 'firebase', 's3', 'custom')),
  ADD COLUMN IF NOT EXISTS backup_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS backup_is_active boolean DEFAULT false;

-- Comentários
COMMENT ON COLUMN public.contract_storage_config.backup_storage_type IS 'Tipo de storage para backup (opcional). Storage principal sempre é Supabase.';
COMMENT ON COLUMN public.contract_storage_config.backup_config IS 'Configurações do storage de backup (credenciais, buckets, etc.)';
COMMENT ON COLUMN public.contract_storage_config.backup_is_active IS 'Se backup storage está ativo. Se false, não faz backup automático.';

