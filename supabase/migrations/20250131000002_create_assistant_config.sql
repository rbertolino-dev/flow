-- ============================================
-- MIGRAÇÃO: Configurações do Assistente IA
-- ============================================
-- Sistema para configurar diretrizes, regras e tom de voz do assistente

-- Tabela de configurações do assistente
CREATE TABLE IF NOT EXISTS public.assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = configuração global (aplicada a todas as organizações)
  -- UUID = configuração específica da organização
  
  -- Diretrizes e regras
  system_prompt TEXT, -- Instruções gerais de como responder
  tone_of_voice TEXT, -- Tom de voz (ex: "profissional", "amigável", "formal")
  rules TEXT, -- Regras específicas (JSON ou texto)
  restrictions TEXT, -- O que NÃO responder ou fazer
  examples TEXT, -- Exemplos de boas respostas (JSON ou texto)
  
  -- Configurações técnicas
  temperature NUMERIC(3,2) DEFAULT 0.7, -- Temperatura do modelo (0.0 a 2.0)
  max_tokens INTEGER DEFAULT 2000, -- Máximo de tokens na resposta
  model TEXT DEFAULT 'deepseek-chat', -- Modelo a usar
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false, -- Se true, aplica a todas as organizações
  
  -- Metadados
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Uma configuração por organização (ou global)
  UNIQUE(organization_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assistant_config_org ON public.assistant_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_config_global ON public.assistant_config(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_assistant_config_active ON public.assistant_config(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

-- Policies RLS
-- Super admins podem ver todas as configurações
CREATE POLICY "Super admins can view all assistant configs"
ON public.assistant_config
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Usuários podem ver configuração da sua organização
CREATE POLICY "Users can view their organization config"
ON public.assistant_config
FOR SELECT
USING (
  organization_id = get_user_organization(auth.uid())
  OR is_global = true
);

-- Super admins podem criar/atualizar configurações
CREATE POLICY "Super admins can manage all assistant configs"
ON public.assistant_config
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_pubdigital_user(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_assistant_config_updated_at
BEFORE UPDATE ON public.assistant_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.assistant_config IS 'Configurações de diretrizes, regras e tom de voz do assistente IA';
COMMENT ON COLUMN public.assistant_config.system_prompt IS 'Instruções gerais de como o assistente deve responder';
COMMENT ON COLUMN public.assistant_config.tone_of_voice IS 'Tom de voz desejado (profissional, amigável, formal, etc.)';
COMMENT ON COLUMN public.assistant_config.rules IS 'Regras específicas de comportamento';
COMMENT ON COLUMN public.assistant_config.restrictions IS 'O que o assistente NÃO deve fazer ou responder';
COMMENT ON COLUMN public.assistant_config.is_global IS 'Se true, esta configuração se aplica a todas as organizações';


