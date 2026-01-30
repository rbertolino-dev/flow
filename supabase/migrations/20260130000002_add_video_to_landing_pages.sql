-- Migration: Adicionar opção de vídeo na landing page (ao lado do formulário)
-- Data: 2026-01-30
-- Descrição: Permite exibir vídeo na parte inferior da página, ao lado do formulário

-- Adicionar colunas para vídeo
ALTER TABLE public.landing_pages
ADD COLUMN IF NOT EXISTS video_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.landing_pages.video_enabled IS 'Exibir vídeo ao lado do formulário na parte inferior';
COMMENT ON COLUMN public.landing_pages.video_url IS 'URL do vídeo (YouTube, Vimeo ou link direto)';
