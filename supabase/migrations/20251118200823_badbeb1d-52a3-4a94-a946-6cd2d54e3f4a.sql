-- Add Evolution OpenAI bot configuration fields to agents table
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS trigger_operator TEXT DEFAULT 'contains',
  ADD COLUMN IF NOT EXISTS trigger_value TEXT,
  ADD COLUMN IF NOT EXISTS expire INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS keyword_finish TEXT DEFAULT '#SAIR',
  ADD COLUMN IF NOT EXISTS delay_message INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS unknown_message TEXT DEFAULT 'Desculpe, não entendi. Pode repetir?',
  ADD COLUMN IF NOT EXISTS listening_from_me BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS stop_bot_from_me BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS keep_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS debounce_time INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS ignore_jids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS function_url TEXT;

COMMENT ON COLUMN public.agents.trigger_type IS 'Tipo de gatilho: keyword, all, etc.';
COMMENT ON COLUMN public.agents.trigger_operator IS 'Operador do gatilho: equals, contains, startsWith, etc.';
COMMENT ON COLUMN public.agents.trigger_value IS 'Valor do gatilho (palavra-chave)';
COMMENT ON COLUMN public.agents.expire IS 'Tempo de expiração da sessão em minutos';
COMMENT ON COLUMN public.agents.keyword_finish IS 'Palavra-chave para encerrar o bot';
COMMENT ON COLUMN public.agents.delay_message IS 'Delay entre mensagens em milissegundos';
COMMENT ON COLUMN public.agents.unknown_message IS 'Mensagem quando não entender o usuário';
COMMENT ON COLUMN public.agents.listening_from_me IS 'Se escuta mensagens enviadas pelo próprio número';
COMMENT ON COLUMN public.agents.stop_bot_from_me IS 'Se para o bot quando recebe mensagem do próprio número';
COMMENT ON COLUMN public.agents.keep_open IS 'Manter conversa aberta após resposta';
COMMENT ON COLUMN public.agents.debounce_time IS 'Tempo de debounce em segundos';
COMMENT ON COLUMN public.agents.ignore_jids IS 'Lista de JIDs para ignorar';
COMMENT ON COLUMN public.agents.function_url IS 'URL para webhook/bridge de funções';