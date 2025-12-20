-- Criar tabela de templates de mensagens
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own templates"
ON public.message_templates
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
ON public.message_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.message_templates
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.message_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();