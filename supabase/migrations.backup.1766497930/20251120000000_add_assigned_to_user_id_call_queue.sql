-- Adicionar campo assigned_to_user_id na tabela call_queue para atribuir leads a usuários
ALTER TABLE public.call_queue 
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas consultas filtradas por usuário
CREATE INDEX IF NOT EXISTS idx_call_queue_assigned_to_user_id ON public.call_queue(assigned_to_user_id);

-- Comentário explicativo
COMMENT ON COLUMN public.call_queue.assigned_to_user_id IS 'Usuário responsável por esta ligação na fila de elegibilidade';

