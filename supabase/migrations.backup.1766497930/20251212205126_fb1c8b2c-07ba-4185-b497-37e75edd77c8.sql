-- 1. Adicionar coluna recipient_type que está faltando em whatsapp_workflows
ALTER TABLE public.whatsapp_workflows 
  ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
    CHECK (recipient_type IN ('list', 'single', 'group'));

-- Atualizar registros existentes baseado no recipient_mode
UPDATE public.whatsapp_workflows
SET recipient_type = CASE 
  WHEN recipient_mode = 'single' THEN 'single'
  WHEN group_id IS NOT NULL THEN 'group'
  ELSE 'list'
END
WHERE recipient_type IS NULL OR recipient_type = 'list';

-- 2. Corrigir funções sem search_path (security warning do linter)
CREATE OR REPLACE FUNCTION public.update_post_sale_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_n8n_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;