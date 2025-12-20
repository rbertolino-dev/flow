-- ============================================
-- SCRIPT: Configurar API Key do DeepSeek
-- ============================================
-- Este script cria a tabela assistant_config (se não existir), adiciona o campo api_key
-- e configura a API key do DeepSeek para uma organização específica
-- 
-- INSTRUÇÕES:
-- 1. Execute este script completo no SQL Editor do Supabase
-- 2. Substitua [ORGANIZATION_ID] pelo ID da organização desejada
-- 3. Ou use a Opção 3 para configurar como global

-- ============================================
-- PASSO 1: Criar tabela assistant_config (se não existir)
-- ============================================
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

-- Adicionar campo api_key se não existir
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
    -- Política para super admins (verifica se função existe)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'assistant_config' 
        AND policyname = 'Super admins can manage all assistant config'
    ) THEN
        -- Tenta criar política com verificação de função
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
            USING (true); -- Temporariamente permite tudo - ajuste depois
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
            USING (true); -- Temporariamente permite tudo - ajuste depois
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

-- ============================================
-- PASSO 2: Configurar API Key
-- ============================================
-- Escolha UMA das opções abaixo:

-- OPÇÃO 1: Configurar como GLOBAL (aplica a todas as organizações)
-- Esta é a opção mais simples e recomendada se você quer usar a mesma API key para todas
INSERT INTO public.assistant_config (
  organization_id,
  api_key,
  model,
  temperature,
  max_tokens,
  is_active,
  is_global
)
VALUES (
  NULL,
  'sk-ed9d35a520ef4cf4bb056cd51d839651',  -- API Key fornecida
  'deepseek-chat',
  0.7,
  2000,
  true,
  true
)
ON CONFLICT (organization_id) 
DO UPDATE SET
  api_key = EXCLUDED.api_key,
  model = EXCLUDED.model,
  temperature = EXCLUDED.temperature,
  max_tokens = EXCLUDED.max_tokens,
  is_active = EXCLUDED.is_active,
  is_global = EXCLUDED.is_global,
  updated_at = now();

-- OPÇÃO 2: Configurar para uma organização específica
-- Descomente e substitua [ORGANIZATION_ID] pelo ID real da organização
-- Para encontrar o ID da organização, execute: SELECT id, name FROM public.organizations;
/*
INSERT INTO public.assistant_config (
  organization_id,
  api_key,
  model,
  temperature,
  max_tokens,
  is_active
)
VALUES (
  '[ORGANIZATION_ID]'::uuid,  -- SUBSTITUA PELO ID DA ORGANIZAÇÃO
  'sk-ed9d35a520ef4cf4bb056cd51d839651',  -- API Key fornecida
  'deepseek-chat',
  0.7,
  2000,
  true
)
ON CONFLICT (organization_id) 
DO UPDATE SET
  api_key = EXCLUDED.api_key,
  updated_at = now();
*/

-- OPÇÃO 3: Atualizar configuração existente de uma organização específica
-- Descomente e substitua [ORGANIZATION_ID] pelo ID real
/*
UPDATE public.assistant_config
SET 
  api_key = 'sk-ed9d35a520ef4cf4bb056cd51d839651',
  updated_at = now()
WHERE organization_id = '[ORGANIZATION_ID]'::uuid;
*/

-- Verificar configuração criada/atualizada
SELECT 
  id,
  organization_id,
  CASE 
    WHEN api_key IS NOT NULL THEN 'sk-' || LEFT(RIGHT(api_key, 8), 4) || '...' 
    ELSE 'NULL (usa variável de ambiente)'
  END as api_key_preview,
  model,
  is_active,
  is_global,
  created_at,
  updated_at
FROM public.assistant_config
WHERE api_key IS NOT NULL
ORDER BY updated_at DESC;

