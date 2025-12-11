-- ============================================
-- MIGRAÇÃO: Tabelas do Assistente IA DeepSeek
-- ============================================
-- Sistema de histórico e auditoria para o assistente de IA

-- Tabela de conversas do assistente
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT, -- Título da conversa (gerado automaticamente ou pelo usuário)
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de mensagens
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de auditoria de ações do assistente
CREATE TABLE IF NOT EXISTS public.assistant_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- Tipo de ação executada (ex: 'create_lead', 'update_lead')
  function_name TEXT NOT NULL, -- Nome da função chamada
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb, -- Parâmetros passados para a função
  result JSONB, -- Resultado da execução
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT, -- Mensagem de erro se houver
  tokens_used INTEGER, -- Tokens usados na requisição (opcional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_org ON public.assistant_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_user ON public.assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated ON public.assistant_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_conversation ON public.assistant_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_org ON public.assistant_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_user ON public.assistant_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_type ON public.assistant_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_assistant_actions_created ON public.assistant_actions(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_actions ENABLE ROW LEVEL SECURITY;

-- Policies RLS para assistant_conversations
-- Usuários só podem ver conversas da sua organização E que foram criadas por eles
-- (ou são admin/pubdigital que podem ver todas)
CREATE POLICY "Users can view conversations of their organization"
ON public.assistant_conversations
FOR SELECT
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create conversations for their organization"
ON public.assistant_conversations
FOR INSERT
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can update conversations of their organization"
ON public.assistant_conversations
FOR UPDATE
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can delete conversations of their organization"
ON public.assistant_conversations
FOR DELETE
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Policies RLS para assistant_actions
-- Usuários só podem ver ações da sua organização E que foram executadas por eles
-- (ou são admin/pubdigital que podem ver todas)
CREATE POLICY "Users can view actions of their organization"
ON public.assistant_actions
FOR SELECT
USING (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create actions for their organization"
ON public.assistant_actions
FOR INSERT
WITH CHECK (
  (
    user_belongs_to_org(auth.uid(), organization_id)
    AND user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.assistant_conversations IS 'Armazena o histórico de conversas do assistente IA';
COMMENT ON TABLE public.assistant_actions IS 'Auditoria de todas as ações executadas pelo assistente IA';

