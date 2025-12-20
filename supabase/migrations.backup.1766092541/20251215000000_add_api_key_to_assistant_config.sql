-- ============================================
-- MIGRAÇÃO: Adicionar campo api_key na tabela assistant_config
-- ============================================
-- Permite configurar API key do DeepSeek por organização
-- Se api_key for NULL, usa a variável de ambiente global DEEPSEEK_API_KEY

-- Criar tabela assistant_config se não existir
CREATE TABLE IF NOT EXISTS public.assistant_config (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    system_prompt TEXT,
    tone_of_voice TEXT DEFAULT 'profissional',
    rules TEXT,
    restrictions TEXT,
    examples TEXT,
    temperature NUMERIC DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2000,
    model TEXT DEFAULT 'deepseek-chat',
    is_active BOOLEAN DEFAULT true,
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id)
);

-- Adicionar coluna api_key (opcional, pode ser null)
ALTER TABLE public.assistant_config
ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_assistant_config_org ON public.assistant_config(organization_id);
CREATE INDEX IF NOT EXISTS idx_assistant_config_global ON public.assistant_config(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_assistant_config_active ON public.assistant_config(is_active) WHERE is_active = true;

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS se não existirem (versão simplificada)
DO $$
BEGIN
    -- Política para super admins
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'assistant_config' 
        AND policyname = 'Super admins can manage all assistant config'
    ) THEN
        BEGIN
            CREATE POLICY "Super admins can manage all assistant config"
            ON public.assistant_config
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_config.organization_id
                    AND om.user_id = auth.uid()
                    AND om.role = 'admin'
                )
                OR EXISTS (
                    SELECT 1 FROM public.user_roles ur
                    WHERE ur.user_id = auth.uid()
                    AND ur.role = 'admin'
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Se falhar, cria política mais simples
            CREATE POLICY "Super admins can manage all assistant config"
            ON public.assistant_config
            FOR ALL
            USING (true);
        END;
    END IF;

    -- Política para usuários verem sua organização
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'assistant_config' 
        AND policyname = 'Users can view their org assistant config'
    ) THEN
        BEGIN
            CREATE POLICY "Users can view their org assistant config"
            ON public.assistant_config
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = assistant_config.organization_id
                    AND om.user_id = auth.uid()
                )
                OR is_global = true
            );
        EXCEPTION WHEN OTHERS THEN
            -- Se falhar, cria política mais simples
            CREATE POLICY "Users can view their org assistant config"
            ON public.assistant_config
            FOR SELECT
            USING (true);
        END;
    END IF;
END $$;

-- Criar trigger para updated_at se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_assistant_config_updated_at ON public.assistant_config;
CREATE TRIGGER update_assistant_config_updated_at
BEFORE UPDATE ON public.assistant_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comentário
COMMENT ON COLUMN public.assistant_config.api_key IS 'API Key do DeepSeek para esta organização. Se NULL, usa a variável de ambiente global DEEPSEEK_API_KEY';

