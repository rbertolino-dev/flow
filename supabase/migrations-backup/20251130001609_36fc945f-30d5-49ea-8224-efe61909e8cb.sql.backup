-- Corrigir search_path das funções criadas anteriormente

CREATE OR REPLACE FUNCTION public.update_google_business_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.update_google_business_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SET search_path TO 'public';