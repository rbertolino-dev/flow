-- Create hubspot_configs table for HubSpot integration
CREATE TABLE public.hubspot_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  portal_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hubspot_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their org hubspot config"
  ON public.hubspot_configs FOR SELECT
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can insert their org hubspot config"
  ON public.hubspot_configs FOR INSERT
  WITH CHECK (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can update their org hubspot config"
  ON public.hubspot_configs FOR UPDATE
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Users can delete their org hubspot config"
  ON public.hubspot_configs FOR DELETE
  USING (user_belongs_to_org(auth.uid(), organization_id) OR has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_hubspot_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hubspot_configs_updated_at
  BEFORE UPDATE ON public.hubspot_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hubspot_configs_updated_at();

DROP INDEX IF EXISTS for CASCADE;
CREATE INDEX for ON
-- Create unique index for one active config per organization
CREATE UNIQUE INDEX hubspot_configs_org_active_idx 
  ON public.hubspot_configs(organization_id) 
  WHERE is_active = true;