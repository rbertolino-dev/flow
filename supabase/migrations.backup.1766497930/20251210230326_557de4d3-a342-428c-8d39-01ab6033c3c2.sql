-- Create user_organizations table to link users with organizations
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their own organization links"
ON public.user_organizations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user organizations"
ON public.user_organizations
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.is_pubdigital_user(auth.uid())
);

-- Create assistant_conversations table for AI assistant chat history
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assistant_conversations
CREATE POLICY "Users can view their own conversations"
ON public.assistant_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON public.assistant_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON public.assistant_conversations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON public.assistant_conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_assistant_conversations_updated_at
BEFORE UPDATE ON public.assistant_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate user_organizations from existing organization_members
INSERT INTO public.user_organizations (user_id, organization_id)
SELECT user_id, organization_id FROM public.organization_members
ON CONFLICT (user_id, organization_id) DO NOTHING;