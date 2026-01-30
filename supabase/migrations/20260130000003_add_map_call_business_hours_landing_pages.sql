-- Migration: Mapa, Botão de Ligação e Horário de Atendimento na landing page
-- Data: 2026-01-30
-- Descrição: Adiciona opções de mapa, ligação e horário de atendimento

-- Mapa/Localização
ALTER TABLE public.landing_pages
ADD COLUMN IF NOT EXISTS map_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS map_embed_url TEXT;

-- Botão de Ligação
ALTER TABLE public.landing_pages
ADD COLUMN IF NOT EXISTS call_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS call_number TEXT;

-- Horário de Atendimento
ALTER TABLE public.landing_pages
ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS business_hours_text TEXT;

COMMENT ON COLUMN public.landing_pages.map_enabled IS 'Exibir mapa de localização na parte inferior';
COMMENT ON COLUMN public.landing_pages.map_embed_url IS 'URL do embed do Google Maps';
COMMENT ON COLUMN public.landing_pages.call_enabled IS 'Exibir botão de ligação (flutuante ou na página)';
COMMENT ON COLUMN public.landing_pages.call_number IS 'Número de telefone para ligação (ex: 5511999999999)';
COMMENT ON COLUMN public.landing_pages.business_hours_enabled IS 'Exibir horário de atendimento';
COMMENT ON COLUMN public.landing_pages.business_hours_text IS 'Texto do horário (ex: Seg-Sex 9h-18h)';
