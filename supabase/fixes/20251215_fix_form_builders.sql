-- ============================================
-- FIX: Criar tabela form_builders
-- Execute no Supabase SQL Editor
-- ============================================

-- Criar tabela de formulários
CREATE TABLE IF NOT EXISTS public.form_builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  style jsonb NOT NULL DEFAULT '{
    "primaryColor": "#3b82f6",
    "secondaryColor": "#64748b",
    "backgroundColor": "#ffffff",
    "textColor": "#1e293b",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "16px",
    "borderRadius": "8px",
    "buttonStyle": "filled",
    "buttonColor": "#3b82f6",
    "buttonTextColor": "#ffffff",
    "inputBorderColor": "#e2e8f0",
    "inputFocusColor": "#3b82f6"
  }'::jsonb,
  success_message text DEFAULT 'Obrigado! Seus dados foram enviados com sucesso.',
  redirect_url text,
  stage_id uuid REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_form_builders_org ON public.form_builders(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_builders_active ON public.form_builders(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.form_builders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view forms from their organization" ON public.form_builders;
CREATE POLICY "Users can view forms from their organization"
  ON public.form_builders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create forms in their organization" ON public.form_builders;
CREATE POLICY "Users can create forms in their organization"
  ON public.form_builders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update forms in their organization" ON public.form_builders;
CREATE POLICY "Users can update forms in their organization"
  ON public.form_builders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete forms in their organization" ON public.form_builders;
CREATE POLICY "Users can delete forms in their organization"
  ON public.form_builders FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_form_builders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_builders_updated_at ON public.form_builders;
CREATE TRIGGER form_builders_updated_at
  BEFORE UPDATE ON public.form_builders
  FOR EACH ROW
  EXECUTE FUNCTION update_form_builders_updated_at();

-- Tabela para submissões de formulários (opcional, para histórico)
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.form_builders(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_org ON public.form_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_lead ON public.form_submissions(lead_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view submissions from their organization" ON public.form_submissions;
CREATE POLICY "Users can view submissions from their organization"
  ON public.form_submissions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Verificar resultado
SELECT 
  'form_builders' as tabela,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'form_builders'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END as status
UNION ALL
SELECT 
  'form_submissions',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name = 'form_submissions'
  ) THEN '✅ Existe' ELSE '❌ Não existe' END;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Aguarde 30-60 segundos após executar para o PostgREST atualizar o cache
-- Depois recarregue a página (F5)

