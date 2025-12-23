-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger para criar profile automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Adicionar campos de auditoria na tabela leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

-- Adicionar campos de auditoria na tabela call_queue
ALTER TABLE public.call_queue
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id);

-- Trigger para atualizar updated_by em leads
CREATE OR REPLACE FUNCTION public.update_lead_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = now();
  
  -- Se for INSERT, também setar created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER lead_audit_trigger
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_audit();

-- Trigger para atualizar updated_by em call_queue
CREATE OR REPLACE FUNCTION public.update_call_queue_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by = auth.uid();
  
  -- Se for INSERT, também setar created_by
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER call_queue_audit_trigger
  BEFORE INSERT OR UPDATE ON public.call_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_call_queue_audit();