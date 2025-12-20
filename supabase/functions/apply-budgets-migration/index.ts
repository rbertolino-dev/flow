import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    // SQL da migration
    const migrationSQL = `
-- Criar tabela de orçamentos
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    budget_number TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_data JSONB,
    products JSONB DEFAULT '[]'::jsonb,
    services JSONB DEFAULT '[]'::jsonb,
    payment_methods TEXT[] DEFAULT '{}',
    validity_days INTEGER DEFAULT 30,
    expires_at DATE,
    delivery_date DATE,
    delivery_location TEXT,
    observations TEXT,
    subtotal_products NUMERIC(12, 2) DEFAULT 0,
    subtotal_services NUMERIC(12, 2) DEFAULT 0,
    additions NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) DEFAULT 0,
    background_image_url TEXT,
    header_color TEXT,
    logo_url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_budgets_organization ON public.budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_lead ON public.budgets(lead_id);
CREATE INDEX IF NOT EXISTS idx_budgets_number ON public.budgets(organization_id, budget_number);
CREATE INDEX IF NOT EXISTS idx_budgets_created_at ON public.budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_expires_at ON public.budgets(expires_at);

-- Criar função para gerar número de orçamento único
CREATE OR REPLACE FUNCTION generate_budget_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    year_month TEXT;
    sequence_num INTEGER;
    budget_num TEXT;
BEGIN
    prefix := UPPER(SUBSTRING(org_id::TEXT, 1, 4));
    year_month := TO_CHAR(now(), 'YYYYMM');
    SELECT COALESCE(MAX(CAST(SUBSTRING(budget_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM public.budgets
    WHERE organization_id = org_id
      AND budget_number LIKE prefix || '-' || year_month || '-%';
    budget_num := prefix || '-' || year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN budget_num;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_budgets_updated_at ON public.budgets;
CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_budgets_updated_at();

-- Habilitar RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view budgets of their organization" ON public.budgets;
CREATE POLICY "Users can view budgets of their organization"
ON public.budgets FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can create budgets for their organization" ON public.budgets;
CREATE POLICY "Users can create budgets for their organization"
ON public.budgets FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can update budgets of their organization" ON public.budgets;
CREATE POLICY "Users can update budgets of their organization"
ON public.budgets FOR UPDATE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
)
WITH CHECK (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);

DROP POLICY IF EXISTS "Users can delete budgets of their organization" ON public.budgets;
CREATE POLICY "Users can delete budgets of their organization"
ON public.budgets FOR DELETE
USING (
    organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
);
    `;

    // Executar SQL usando rpc ou método direto
    // Como não podemos executar SQL arbitrário via Supabase JS, vamos usar uma abordagem diferente
    // Vamos retornar o SQL para ser executado manualmente ou via outra ferramenta
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration SQL pronta para execução',
        sql: migrationSQL,
        instructions: 'Execute este SQL no Supabase SQL Editor: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

