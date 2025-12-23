-- Create broadcast campaign templates table
CREATE TABLE IF NOT EXISTS public.broadcast_campaign_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instance_id UUID,
  instance_name TEXT,
  message_template_id UUID,
  custom_message TEXT,
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.broadcast_campaign_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcast_campaign_templates
CREATE POLICY "Users can view organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can create organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can update organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR UPDATE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Users can delete organization campaign templates"
  ON public.broadcast_campaign_templates
  FOR DELETE
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Super admins can view all campaign templates"
  ON public.broadcast_campaign_templates
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Create updated_at trigger
CREATE TRIGGER update_broadcast_campaign_templates_updated_at
  BEFORE UPDATE ON public.broadcast_campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_broadcast_campaign_templates_org_id 
  ON public.broadcast_campaign_templates(organization_id);