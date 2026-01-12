-- ============================================
-- Adicionar campos dinâmicos para personalização
-- ============================================
-- Permite armazenar campos adicionais do CSV como empresa, nome_empresa, email, etc.
-- Esses campos podem ser usados nas tags dinâmicas do template
-- ============================================

-- Adicionar campos dinâmicos opcionais
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS nome_empresa TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB; -- Para campos customizados adicionais

-- Criar índices para busca
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_empresa 
  ON public.broadcast_queue(empresa) 
  WHERE empresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_nome_empresa 
  ON public.broadcast_queue(nome_empresa) 
  WHERE nome_empresa IS NOT NULL;

-- Comentários
COMMENT ON COLUMN public.broadcast_queue.empresa IS 'Nome curto da empresa (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue.nome_empresa IS 'Nome completo/razão social da empresa (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue.email IS 'Email do contato (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue.cpf IS 'CPF do contato (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue.cnpj IS 'CNPJ da empresa (usado em tags dinâmicas)';
COMMENT ON COLUMN public.broadcast_queue.custom_fields IS 'Campos customizados adicionais do CSV em formato JSON (usado em tags dinâmicas)';
