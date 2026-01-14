-- ============================================
-- Garantir que campos dinâmicos existam na broadcast_queue
-- ============================================
-- Esta migration garante que as colunas empresa, nome_empresa, email, cpf, cnpj e custom_fields
-- existam na tabela broadcast_queue, mesmo que a migration anterior tenha falhado
-- ============================================

-- Adicionar campos dinâmicos opcionais (IF NOT EXISTS garante que não dá erro se já existirem)
ALTER TABLE public.broadcast_queue
  ADD COLUMN IF NOT EXISTS empresa TEXT,
  ADD COLUMN IF NOT EXISTS nome_empresa TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB;

-- Criar índices para busca (IF NOT EXISTS garante que não dá erro se já existirem)
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_empresa 
  ON public.broadcast_queue(empresa) 
  WHERE empresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_nome_empresa 
  ON public.broadcast_queue(nome_empresa) 
  WHERE nome_empresa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_email 
  ON public.broadcast_queue(email) 
  WHERE email IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.broadcast_queue.empresa IS 'Nome curto da empresa (usado em tags dinâmicas {empresa})';
COMMENT ON COLUMN public.broadcast_queue.nome_empresa IS 'Nome completo/razão social da empresa (usado em tags dinâmicas {nome_empresa})';
COMMENT ON COLUMN public.broadcast_queue.email IS 'Email do contato (usado em tags dinâmicas {email})';
COMMENT ON COLUMN public.broadcast_queue.cpf IS 'CPF do contato (usado em tags dinâmicas {cpf})';
COMMENT ON COLUMN public.broadcast_queue.cnpj IS 'CNPJ da empresa (usado em tags dinâmicas {cnpj})';
COMMENT ON COLUMN public.broadcast_queue.custom_fields IS 'Campos customizados adicionais do CSV em formato JSON (usado em tags dinâmicas)';
