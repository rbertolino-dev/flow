-- Create table for Bubble.io configurations
CREATE TABLE IF NOT EXISTS public.bubble_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.bubble_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's bubble config"
  ON public.bubble_configs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bubble config for their organization"
  ON public.bubble_configs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's bubble config"
  ON public.bubble_configs FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's bubble config"
  ON public.bubble_configs FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create index
CREATE INDEX idx_bubble_configs_organization_id ON public.bubble_configs(organization_id);

-- Create updated_at trigger
CREATE TRIGGER update_bubble_configs_updated_at
  BEFORE UPDATE ON public.bubble_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for storing Bubble query history (to control usage)
CREATE TABLE IF NOT EXISTS public.bubble_query_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL,
  query_params JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bubble_query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's query history"
  ON public.bubble_query_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert query history for their organization"
  ON public.bubble_query_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Create index
CREATE INDEX idx_bubble_query_history_organization_id ON public.bubble_query_history(organization_id);
CREATE INDEX idx_bubble_query_history_created_at ON public.bubble_query_history(created_at DESC);