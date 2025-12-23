-- Adicionar campo para controlar se o webhook está ativado para cada instância
ALTER TABLE public.evolution_config
ADD COLUMN webhook_enabled boolean NOT NULL DEFAULT true;

-- Adicionar índice para melhorar performance de buscas por usuário
CREATE INDEX IF NOT EXISTS idx_evolution_config_user_id ON public.evolution_config(user_id);

-- Adicionar política RLS para permitir delete
DROP POLICY IF EXISTS "Users can delete their own config" ON public.evolution_config;
CREATE POLICY "Users can delete their own config"
ON public.evolution_config
FOR DELETE
USING (auth.uid() = user_id);