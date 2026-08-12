-- Logo/imagem das campanhas e templates WAHA, no mesmo modelo do Disparador Evolution.

ALTER TABLE public.broadcast_templates_waha
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.broadcast_campaigns_waha
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.broadcast_templates_waha.image_url IS
  'URL da logo/imagem enviada junto com o template WAHA (opcional).';
COMMENT ON COLUMN public.broadcast_campaigns_waha.image_url IS
  'URL da logo/imagem enviada junto com a campanha WAHA (opcional).';
