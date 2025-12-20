-- ============================================
-- SCRIPT: Criar Tabelas do Assistente (Mínimo)
-- ============================================
-- Versão mínima - apenas cria as tabelas, sem políticas complexas

-- 1. Verificar quais tabelas existem ANTES
SELECT 
  'ANTES' as momento,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')
ORDER BY table_name;

-- 2. Criar tabela assistant_conversations se não existir
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Criar tabela assistant_actions se não existir
CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  function_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Criar índices básicos
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_org ON public.assistant_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_org ON public.assistant_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_user ON public.assistant_actions(user_id);

-- 5. Habilitar RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS MUITO SIMPLES (apenas por user_id)
-- Isso permite que funcione mesmo sem funções auxiliares

-- Políticas para assistant_conversations
DROP POLICY IF EXISTS "Simple: users can manage their conversations" ON public.assistant_conversations;
CREATE POLICY "Simple: users can manage their conversations"
ON public.assistant_conversations
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Políticas para assistant_actions
DROP POLICY IF EXISTS "Simple: users can manage their actions" ON public.assistant_actions;
CREATE POLICY "Simple: users can manage their actions"
ON public.assistant_actions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 7. Criar função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_assistant_conversations_updated_at ON public.assistant_conversations;
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Verificar resultado
SELECT 
  'DEPOIS' as momento,
  COUNT(*) as total_tabelas,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ OK - Todas as 3 tabelas existem'
    ELSE '❌ FALTANDO - Apenas ' || COUNT(*) || ' de 3 tabelas'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions');

-- 10. Listar tabelas criadas
SELECT 
  table_name,
  '✅ Criada' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')
ORDER BY table_name;



