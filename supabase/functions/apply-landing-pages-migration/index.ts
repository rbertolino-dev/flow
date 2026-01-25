import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // SQL da migration
    const migrationSQL = `
-- Migration: Criar tabelas para Landing Pages de Vendas
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  slug TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'modern',
  cover_image_url TEXT,
  logo_url TEXT,
  logo_position TEXT DEFAULT 'top-left',
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1e40af',
  title TEXT NOT NULL,
  subtitle TEXT,
  about_text TEXT,
  show_all_items BOOLEAN DEFAULT true,
  item_order TEXT DEFAULT 'recent',
  show_price BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  whatsapp_instance_id UUID REFERENCES public.evolution_config(id),
  whatsapp_number TEXT,
  whatsapp_message_template TEXT DEFAULT 'Olá! Vim pela página de vendas da {empresa}. Tenho interesse em {item}. Pode me passar um orçamento?',
  whatsapp_button_text TEXT DEFAULT 'Pedir Orçamento',
  whatsapp_floating_button BOOLEAN DEFAULT true,
  form_enabled BOOLEAN DEFAULT false,
  form_title TEXT DEFAULT 'Receba um orçamento',
  form_position TEXT DEFAULT 'bottom',
  form_fields JSONB DEFAULT '{"name": true, "phone": true, "email": false, "message": false}'::jsonb,
  form_destination TEXT DEFAULT 'leads',
  form_notification_email TEXT,
  seo_title TEXT,
  seo_description TEXT,
  seo_og_image_url TEXT,
  highlights JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  social_proof JSONB DEFAULT '{}'::jsonb,
  footer_enabled BOOLEAN DEFAULT true,
  footer_text TEXT,
  footer_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_organization ON public.landing_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_active ON public.landing_pages(is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_landing_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_landing_pages_updated_at ON public.landing_pages;
CREATE TRIGGER update_landing_pages_updated_at
    BEFORE UPDATE ON public.landing_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_pages_updated_at();

CREATE TABLE IF NOT EXISTS public.landing_page_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  custom_title TEXT,
  custom_description TEXT,
  custom_image_url TEXT,
  custom_price NUMERIC(12,2),
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(landing_page_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_landing_page_items_landing_page ON public.landing_page_items(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_items_product ON public.landing_page_items(product_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_items_order ON public.landing_page_items(landing_page_id, display_order);

CREATE OR REPLACE FUNCTION update_landing_page_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_landing_page_items_updated_at ON public.landing_page_items;
CREATE TRIGGER update_landing_page_items_updated_at
    BEFORE UPDATE ON public.landing_page_items
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_page_items_updated_at();

CREATE TABLE IF NOT EXISTS public.landing_page_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT,
  source TEXT DEFAULT 'landing_page',
  page_url TEXT,
  ip_address INET,
  user_agent TEXT,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  lead_id UUID REFERENCES public.leads(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_page_leads_landing_page ON public.landing_page_leads(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_organization ON public.landing_page_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_processed ON public.landing_page_leads(is_processed) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_ip ON public.landing_page_leads(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_created ON public.landing_page_leads(created_at DESC);

ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view landing pages of their organization" ON public.landing_pages;
CREATE POLICY "Users can view landing pages of their organization"
  ON public.landing_pages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
    OR (is_active = true)
  );

DROP POLICY IF EXISTS "Users can create landing pages for their organization" ON public.landing_pages;
CREATE POLICY "Users can create landing pages for their organization"
  ON public.landing_pages FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update landing pages of their organization" ON public.landing_pages;
CREATE POLICY "Users can update landing pages of their organization"
  ON public.landing_pages FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete landing pages of their organization" ON public.landing_pages;
CREATE POLICY "Users can delete landing pages of their organization"
  ON public.landing_pages FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Users can view landing page items" ON public.landing_page_items;
CREATE POLICY "Users can view landing page items"
  ON public.landing_page_items FOR SELECT
  USING (
    landing_page_id IN (
      SELECT id FROM public.landing_pages
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
      OR (
        is_active = true AND 
        id = landing_page_items.landing_page_id
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage landing page items" ON public.landing_page_items;
CREATE POLICY "Users can manage landing page items"
  ON public.landing_page_items FOR ALL
  USING (
    landing_page_id IN (
      SELECT id FROM public.landing_pages
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  )
  WITH CHECK (
    landing_page_id IN (
      SELECT id FROM public.landing_pages
      WHERE organization_id IN (
        SELECT organization_id 
        FROM public.organization_members 
        WHERE user_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_pubdigital_user(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view landing page leads of their organization" ON public.landing_page_leads;
CREATE POLICY "Users can view landing page leads of their organization"
  ON public.landing_page_leads FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_pubdigital_user(auth.uid())
  );

DROP POLICY IF EXISTS "Public can create landing page leads" ON public.landing_page_leads;
CREATE POLICY "Public can create landing page leads"
  ON public.landing_page_leads FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update landing page leads of their organization" ON public.landing_page_leads;
CREATE POLICY "Users can update landing page leads of their organization"
  ON public.landing_page_leads FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete landing page leads of their organization" ON public.landing_page_leads;
CREATE POLICY "Users can delete landing page leads of their organization"
  ON public.landing_page_leads FOR DELETE
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

    // Executar SQL via RPC exec_sql se existir, senão usar método direto
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: migrationSQL 
      });
      
      if (error) {
        // Se RPC não existir, tentar executar comandos individualmente via query direta
        // Mas isso não funciona para DDL, então vamos retornar instruções
        return new Response(
          JSON.stringify({
            success: false,
            message: "Não é possível executar DDL via API REST. Aplicando via método alternativo...",
            error: error.message,
            instructions: "Execute o SQL no Supabase SQL Editor: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new"
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Migration aplicada com sucesso!",
          data 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: err.message,
          message: "Execute o SQL manualmente no Supabase SQL Editor"
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
