# 🚀 Como Aplicar a Migração do Form Builder

## ❌ Erro Atual
```
Could not find the table 'public.form_builders' in the schema.cache
```

## ✅ Solução: Aplicar Migração

### **OPÇÃO 1: Via Supabase Dashboard (Recomendado)**

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix
   - Faça login se necessário

2. **Vá em SQL Editor:**
   - Menu lateral esquerdo → **SQL Editor**

3. **Cole o conteúdo da migração:**
   - Abra o arquivo: `supabase/migrations/20250124000000_create_form_builders.sql`
   - **Copie TODO o conteúdo** do arquivo
   - Cole no SQL Editor do Supabase
   - Clique em **RUN** (ou pressione Ctrl+Enter)

4. **Verificar se funcionou:**
   - Vá em **Table Editor** (menu lateral)
   - Deve aparecer a nova tabela:
     - ✅ `form_builders`
     - ✅ `form_submissions`
   - Verifique se as políticas RLS foram criadas

---

### **OPÇÃO 2: Via Supabase CLI (Se tiver instalado)**

```powershell
cd C:\Users\Rubens\lovable\agilize
supabase db push
```

---

### **OPÇÃO 3: Copiar e Colar SQL Direto**

Se preferir, aqui está o SQL completo para copiar:

```sql
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

CREATE POLICY "Users can view forms from their organization"
  ON public.form_builders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create forms in their organization"
  ON public.form_builders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update forms in their organization"
  ON public.form_builders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE POLICY "Users can view submissions from their organization"
  ON public.form_submissions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## ✅ Verificação

Após aplicar a migração:

1. **Recarregue a página** do Form Builder
2. **Verifique se o erro sumiu**
3. **Tente criar um novo formulário**

---

## 🆘 Se ainda der erro

1. Verifique se você está logado
2. Verifique se tem uma organização ativa
3. Verifique os logs do Supabase para erros específicos
4. Tente executar o SQL novamente

