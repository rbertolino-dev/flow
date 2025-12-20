
-- Migration: 20251106024613

-- Migration: 20251105204309
-- Tabela de configuração da Evolution API
CREATE TABLE IF NOT EXISTS public.evolution_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_url TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  api_key TEXT,
  is_connected BOOLEAN DEFAULT false,
  qr_code TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  value DECIMAL(10,2),
  source TEXT DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de atividades
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de fila de ligações
CREATE TABLE IF NOT EXISTS public.call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_queue_lead_id ON public.call_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_evolution_config_user_id ON public.evolution_config(user_id);

-- Enable RLS
ALTER TABLE public.evolution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies para evolution_config
CREATE POLICY "Users can view their own config"
  ON public.evolution_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own config"
  ON public.evolution_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own config"
  ON public.evolution_config FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies para leads
CREATE POLICY "Users can view their own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON public.leads FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies para activities
CREATE POLICY "Users can view activities of their leads"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = activities.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert activities for their leads"
  ON public.activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = activities.lead_id
      AND leads.user_id = auth.uid()
    )
  );

-- RLS Policies para call_queue
CREATE POLICY "Users can view their own call queue"
  ON public.call_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert into their call queue"
  ON public.call_queue FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their call queue"
  ON public.call_queue FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = call_queue.lead_id
      AND leads.user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evolution_config_updated_at
  BEFORE UPDATE ON public.evolution_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for leads and activities
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.call_queue REPLICA IDENTITY FULL;

-- Migration: 20251105204414
-- Corrigir função update_updated_at_column com search_path seguro
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Migration: 20251105210120
-- Enable realtime for leads and call_queue tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_queue;

