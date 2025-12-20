-- ============================================
-- SCRIPT: Criar Tabelas do Assistente Faltantes
-- ============================================
-- Este script cria as tabelas que estão faltando

-- 1. Verificar quais tabelas existem
SELECT 
  'Tabelas Existentes' as info,
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

-- 4. Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_org ON public.assistant_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated ON public.assistant_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_conversation ON public.assistant_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_org ON public.assistant_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_user ON public.assistant_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_type ON public.assistant_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_created ON public.assistant_actions(created_at DESC);

-- 5. Habilitar RLS se não estiver habilitado
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS se não existirem (versão simplificada e segura)
DO $$
BEGIN
    -- Políticas para assistant_conversations
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can view conversations of their organization'
        ) THEN
            CREATE POLICY "Users can view conversations of their organization"
            ON public.assistant_conversations
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_conversations.organization_id
                    AND om.user_id = auth.uid()
                )
                AND user_id = auth.uid()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar, cria política mais simples
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can view conversations of their organization'
        ) THEN
            CREATE POLICY "Users can view conversations of their organization"
            ON public.assistant_conversations
            FOR SELECT
            USING (user_id = auth.uid());
        END IF;
    END;

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can create conversations for their organization'
        ) THEN
            CREATE POLICY "Users can create conversations for their organization"
            ON public.assistant_conversations
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_conversations.organization_id
                    AND om.user_id = auth.uid()
                )
                AND user_id = auth.uid()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can create conversations for their organization'
        ) THEN
            CREATE POLICY "Users can create conversations for their organization"
            ON public.assistant_conversations
            FOR INSERT
            WITH CHECK (user_id = auth.uid());
        END IF;
    END;

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can update conversations of their organization'
        ) THEN
            CREATE POLICY "Users can update conversations of their organization"
            ON public.assistant_conversations
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_conversations.organization_id
                    AND om.user_id = auth.uid()
                )
                AND user_id = auth.uid()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_conversations' 
            AND policyname = 'Users can update conversations of their organization'
        ) THEN
            CREATE POLICY "Users can update conversations of their organization"
            ON public.assistant_conversations
            FOR UPDATE
            USING (user_id = auth.uid());
        END IF;
    END;

    -- Políticas para assistant_actions
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_actions' 
            AND policyname = 'Users can view actions of their organization'
        ) THEN
            CREATE POLICY "Users can view actions of their organization"
            ON public.assistant_actions
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_actions.organization_id
                    AND om.user_id = auth.uid()
                )
                AND user_id = auth.uid()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_actions' 
            AND policyname = 'Users can view actions of their organization'
        ) THEN
            CREATE POLICY "Users can view actions of their organization"
            ON public.assistant_actions
            FOR SELECT
            USING (user_id = auth.uid());
        END IF;
    END;

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_actions' 
            AND policyname = 'Users can create actions for their organization'
        ) THEN
            CREATE POLICY "Users can create actions for their organization"
            ON public.assistant_actions
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_actions.organization_id
                    AND om.user_id = auth.uid()
                )
                AND user_id = auth.uid()
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = 'assistant_actions' 
            AND policyname = 'Users can create actions for their organization'
        ) THEN
            CREATE POLICY "Users can create actions for their organization"
            ON public.assistant_actions
            FOR INSERT
            WITH CHECK (user_id = auth.uid());
        END IF;
    END;
END $$;

-- 7. Criar trigger para updated_at se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_assistant_conversations_updated_at ON public.assistant_conversations;
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 8. Verificar resultado final
SELECT 
  'Verificação Final' as info,
  COUNT(*) as total_tabelas,
  CASE 
    WHEN COUNT(*) = 3 THEN '✅ Todas as tabelas criadas'
    ELSE '❌ Ainda faltam ' || (3 - COUNT(*)) || ' tabela(s)'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions');

-- 9. Listar todas as tabelas criadas
SELECT 
  'Tabelas do Assistente' as categoria,
  table_name,
  '✅ Criada' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assistant_config', 'assistant_conversations', 'assistant_actions')
ORDER BY table_name;

