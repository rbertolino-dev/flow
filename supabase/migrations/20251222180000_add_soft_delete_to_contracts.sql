-- Adicionar coluna deleted_at para soft delete
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Criar índice para filtrar contratos não deletados
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON public.contracts(deleted_at) WHERE deleted_at IS NULL;

-- Atualizar RLS para não mostrar contratos deletados por padrão
-- (mantém políticas existentes, apenas filtra deleted_at IS NULL nas queries)

-- Comentário explicativo
COMMENT ON COLUMN public.contracts.deleted_at IS 'Data e hora da exclusão (soft delete). NULL = não deletado';
COMMENT ON COLUMN public.contracts.deleted_by IS 'ID do usuário que deletou o contrato';


