import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação (apenas super admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se é super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é super admin (via user_roles)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // SQL de correção
    const sql = `
-- Remover políticas antigas de contracts
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_templates
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
`;

    // Executar SQL via RPC (se disponível) ou retornar instruções
    // Nota: Supabase não permite executar SQL arbitrário via API por segurança
    // Vamos retornar o SQL para ser executado manualmente
    
    return new Response(
      JSON.stringify({
        message: 'SQL preparado. Execute no SQL Editor do Supabase Dashboard.',
        sql: sql,
        instructions: [
          '1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new',
          '2. Cole o SQL acima',
          '3. Clique em Run'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação (apenas super admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se é super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é super admin (via user_roles)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // SQL de correção
    const sql = `
-- Remover políticas antigas de contracts
DROP POLICY IF EXISTS "Users can view contracts from their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can create contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts in their organization" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view contracts from their organization"
ON public.contracts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create contracts in their organization"
ON public.contracts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contracts.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_templates
DROP POLICY IF EXISTS "Users can view templates from their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can create templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Users can update templates in their organization" ON public.contract_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.contract_templates;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view templates from their organization"
ON public.contract_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create templates in their organization"
ON public.contract_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update templates in their organization"
ON public.contract_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete templates"
ON public.contract_templates FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = contract_templates.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'owner')
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Remover políticas antigas de contract_signatures
DROP POLICY IF EXISTS "Users can view signatures from their organization" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for contracts in their organization" ON public.contract_signatures;

-- Criar novas políticas com suporte a pubdigital
CREATE POLICY "Users can view signatures from their organization"
ON public.contract_signatures FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_pubdigital_user(auth.uid())
);

CREATE POLICY "Users can create signatures for contracts in their organization"
ON public.contract_signatures FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contracts c
    INNER JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = contract_signatures.contract_id
      AND om.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
`;

    // Executar SQL via RPC (se disponível) ou retornar instruções
    // Nota: Supabase não permite executar SQL arbitrário via API por segurança
    // Vamos retornar o SQL para ser executado manualmente
    
    return new Response(
      JSON.stringify({
        message: 'SQL preparado. Execute no SQL Editor do Supabase Dashboard.',
        sql: sql,
        instructions: [
          '1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new',
          '2. Cole o SQL acima',
          '3. Clique em Run'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});













