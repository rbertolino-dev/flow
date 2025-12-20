-- Criar tabela para contatos internacionais
CREATE TABLE public.international_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  country_code TEXT,
  email TEXT,
  company TEXT,
  source TEXT DEFAULT 'whatsapp',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_contact TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela para contatos WhatsApp LID (Business/Canais)
CREATE TABLE public.whatsapp_lid_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  lid TEXT NOT NULL UNIQUE,
  profile_pic_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_contact TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para performance
DROP INDEX IF EXISTS idx_international_contacts_user_id CASCADE;
CREATE INDEX idx_international_contacts_user_id ON
CREATE INDEX idx_international_contacts_user_id ON public.international_contacts(user_id);
DROP INDEX IF EXISTS idx_international_contacts_phone CASCADE;
CREATE INDEX idx_international_contacts_phone ON
CREATE INDEX idx_international_contacts_phone ON public.international_contacts(phone);
DROP INDEX IF EXISTS idx_whatsapp_lid_contacts_user_id CASCADE;
CREATE INDEX idx_whatsapp_lid_contacts_user_id ON
CREATE INDEX idx_whatsapp_lid_contacts_user_id ON public.whatsapp_lid_contacts(user_id);
DROP INDEX IF EXISTS idx_whatsapp_lid_contacts_lid CASCADE;
CREATE INDEX idx_whatsapp_lid_contacts_lid ON
CREATE INDEX idx_whatsapp_lid_contacts_lid ON public.whatsapp_lid_contacts(lid);

-- RLS para international_contacts
ALTER TABLE public.international_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own international contacts"
ON public.international_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own international contacts"
ON public.international_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own international contacts"
ON public.international_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own international contacts"
ON public.international_contacts FOR DELETE
USING (auth.uid() = user_id);

-- RLS para whatsapp_lid_contacts
ALTER TABLE public.whatsapp_lid_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own LID contacts"
ON public.whatsapp_lid_contacts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LID contacts"
ON public.whatsapp_lid_contacts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LID contacts"
ON public.whatsapp_lid_contacts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LID contacts"
ON public.whatsapp_lid_contacts FOR DELETE
USING (auth.uid() = user_id);

-- Triggers para atualizar updated_at
CREATE TRIGGER update_international_contacts_updated_at
BEFORE UPDATE ON public.international_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_lid_contacts_updated_at
BEFORE UPDATE ON public.whatsapp_lid_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();