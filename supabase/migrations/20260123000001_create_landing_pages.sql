-- Migration: Criar tabelas para Landing Pages de Vendas
-- Data: 2026-01-23
-- Descrição: Sistema de landing pages públicas com produtos/serviços e integração WhatsApp

-- =====================================================
-- TABELA 1: landing_pages - Configuração principal da landing page
-- =====================================================
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Status e visibilidade
  is_active BOOLEAN NOT NULL DEFAULT false,
  slug TEXT NOT NULL, -- URL amigável (ex: "minha-empresa")
  
  -- Template e layout
  template TEXT NOT NULL DEFAULT 'modern', -- 'modern' ou 'catalog'
  
  -- Identidade visual
  cover_image_url TEXT, -- Imagem de capa/banner
  logo_url TEXT, -- Logo da empresa
  logo_position TEXT DEFAULT 'top-left', -- 'top-left', 'top-center', 'top-right'
  primary_color TEXT DEFAULT '#3b82f6', -- Cor primária (hex)
  secondary_color TEXT DEFAULT '#1e40af', -- Cor secundária (hex)
  
  -- Conteúdo
  title TEXT NOT NULL, -- Título principal
  subtitle TEXT, -- Subtítulo opcional
  about_text TEXT, -- Texto "sobre" curto
  
  -- Configuração de produtos/serviços
  show_all_items BOOLEAN DEFAULT true, -- Mostrar todos ou selecionar específicos
  item_order TEXT DEFAULT 'recent', -- 'recent', 'category', 'manual'
  show_price BOOLEAN DEFAULT true, -- Exibir preço nos cards
  
  -- Configuração WhatsApp
  whatsapp_enabled BOOLEAN DEFAULT true,
  whatsapp_instance_id UUID REFERENCES public.evolution_config(id), -- Instância Evolution selecionada
  whatsapp_number TEXT, -- Número fixo (opcional, se não usar instância)
  whatsapp_message_template TEXT DEFAULT 'Olá! Vim pela página de vendas da {empresa}. Tenho interesse em {item}. Pode me passar um orçamento?',
  whatsapp_button_text TEXT DEFAULT 'Pedir Orçamento',
  whatsapp_floating_button BOOLEAN DEFAULT true, -- Botão flutuante no mobile
  
  -- Configuração formulário
  form_enabled BOOLEAN DEFAULT false,
  form_title TEXT DEFAULT 'Receba um orçamento',
  form_position TEXT DEFAULT 'bottom', -- 'middle' ou 'bottom'
  form_fields JSONB DEFAULT '{"name": true, "phone": true, "email": false, "message": false}'::jsonb,
  form_destination TEXT DEFAULT 'leads', -- 'leads' ou 'email'
  form_notification_email TEXT, -- Email para receber notificações
  
  -- SEO
  seo_title TEXT, -- Title tag (se não informado, usa title)
  seo_description TEXT, -- Meta description
  seo_og_image_url TEXT, -- Open Graph image (se não informado, usa cover_image_url)
  
  -- Destaques/Benefícios (JSON array de strings)
  highlights JSONB DEFAULT '[]'::jsonb,
  
  -- Prova social (opcional)
  testimonials JSONB DEFAULT '[]'::jsonb, -- Array de {name, text, rating}
  social_proof JSONB DEFAULT '{}'::jsonb, -- {clients: 0, projects: 0, years: 0}
  
  -- Rodapé
  footer_enabled BOOLEAN DEFAULT true,
  footer_text TEXT,
  footer_links JSONB DEFAULT '[]'::jsonb, -- Array de {label, url}
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  
  -- Constraints
  UNIQUE(organization_id, slug)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_landing_pages_organization ON public.landing_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON public.landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_active ON public.landing_pages(is_active) WHERE is_active = true;

-- Trigger para updated_at
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

-- =====================================================
-- TABELA 2: landing_page_items - Produtos/serviços selecionados
-- =====================================================
CREATE TABLE IF NOT EXISTS public.landing_page_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Ordenação manual (quando item_order = 'manual')
  display_order INTEGER DEFAULT 0,
  
  -- Personalização específica da landing page
  custom_title TEXT, -- Sobrescreve nome do produto
  custom_description TEXT, -- Sobrescreve descrição do produto
  custom_image_url TEXT, -- Sobrescreve imagem do produto
  custom_price NUMERIC(12,2), -- Sobrescreve preço do produto
  
  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: um produto só pode aparecer uma vez por landing page
  UNIQUE(landing_page_id, product_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_landing_page_items_landing_page ON public.landing_page_items(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_items_product ON public.landing_page_items(product_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_items_order ON public.landing_page_items(landing_page_id, display_order);

-- Trigger para updated_at
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

-- =====================================================
-- TABELA 3: landing_page_leads - Leads capturados via formulário
-- =====================================================
CREATE TABLE IF NOT EXISTS public.landing_page_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Dados do lead
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT, -- Mensagem/interesse do formulário
  
  -- Contexto
  product_id UUID REFERENCES public.products(id), -- Produto de interesse (se clicou em um)
  product_name TEXT, -- Nome do produto (snapshot)
  source TEXT DEFAULT 'landing_page', -- Origem do lead
  page_url TEXT, -- URL da página quando preencheu formulário
  
  -- Antispam
  ip_address INET, -- IP do visitante
  user_agent TEXT, -- User agent do navegador
  
  -- Status
  is_processed BOOLEAN DEFAULT false, -- Se já foi processado/criado lead no CRM
  processed_at TIMESTAMPTZ, -- Quando foi processado
  lead_id UUID REFERENCES public.leads(id), -- Lead criado no CRM (se processado)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: rate limit por IP (máximo 5 leads por hora por IP)
  CONSTRAINT landing_page_leads_rate_limit CHECK (
    (SELECT COUNT(*) FROM public.landing_page_leads 
     WHERE ip_address = landing_page_leads.ip_address 
     AND created_at > now() - INTERVAL '1 hour') <= 5
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_landing_page ON public.landing_page_leads(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_organization ON public.landing_page_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_processed ON public.landing_page_leads(is_processed) WHERE is_processed = false;
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_ip ON public.landing_page_leads(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_landing_page_leads_created ON public.landing_page_leads(created_at DESC);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_leads ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: landing_pages
-- =====================================================

-- SELECT: Membros da organização podem ver suas landing pages
-- Público pode ver apenas landing pages ativas (para exibição pública)
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
    OR (is_active = true) -- Landing pages ativas são públicas
  );

-- INSERT: Apenas membros da organização podem criar
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

-- UPDATE: Apenas membros da organização podem atualizar
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

-- DELETE: Apenas membros da organização podem deletar
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

-- =====================================================
-- RLS Policies: landing_page_items
-- =====================================================

-- SELECT: Membros da organização ou público (se landing page ativa)
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

-- INSERT/UPDATE/DELETE: Apenas membros da organização
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

-- =====================================================
-- RLS Policies: landing_page_leads
-- =====================================================

-- SELECT: Apenas membros da organização podem ver leads
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

-- INSERT: Público pode criar leads (formulário), mas apenas da sua organização
-- Usar service role key para inserção pública via edge function
CREATE POLICY "Public can create landing page leads"
  ON public.landing_page_leads FOR INSERT
  WITH CHECK (true); -- Permitir inserção pública (edge function valida)

-- UPDATE: Apenas membros da organização podem atualizar
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

-- DELETE: Apenas membros da organização podem deletar
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

-- =====================================================
-- Comentários para documentação
-- =====================================================
COMMENT ON TABLE public.landing_pages IS 'Configuração principal das landing pages de vendas';
COMMENT ON TABLE public.landing_page_items IS 'Produtos/serviços selecionados para exibir na landing page';
COMMENT ON TABLE public.landing_page_leads IS 'Leads capturados via formulário da landing page';

COMMENT ON COLUMN public.landing_pages.template IS 'Template visual: modern (minimal) ou catalog (vitrine)';
COMMENT ON COLUMN public.landing_pages.slug IS 'URL amigável única por organização (ex: minha-empresa)';
COMMENT ON COLUMN public.landing_pages.whatsapp_message_template IS 'Template de mensagem com variáveis: {empresa}, {item}, {tipo_item}, {url_pagina}, {data_hora}';
COMMENT ON COLUMN public.landing_pages.form_fields IS 'JSON com campos do formulário: {name: bool, phone: bool, email: bool, message: bool}';
COMMENT ON COLUMN public.landing_pages.highlights IS 'Array JSON de strings com destaques/benefícios';
COMMENT ON COLUMN public.landing_pages.testimonials IS 'Array JSON de depoimentos: [{name, text, rating}]';
COMMENT ON COLUMN public.landing_pages.social_proof IS 'JSON com números de prova social: {clients, projects, years}';
