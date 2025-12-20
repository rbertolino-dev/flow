-- Tabela para campanhas de disparo em massa
CREATE TABLE public.broadcast_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  message_template_id UUID REFERENCES public.message_templates(id),
  custom_message TEXT,
  instance_id UUID REFERENCES public.evolution_config(id) NOT NULL,
  min_delay_seconds INTEGER NOT NULL DEFAULT 30,
  max_delay_seconds INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'draft',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled'))
);

-- Tabela para fila de contatos da campanha
CREATE TABLE public.broadcast_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.broadcast_campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'scheduled', 'sent', 'failed'))
);

-- Habilitar RLS
ALTER TABLE public.broadcast_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para campanhas
CREATE POLICY "Users can view their own campaigns"
ON public.broadcast_campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
ON public.broadcast_campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON public.broadcast_campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON public.broadcast_campaigns FOR DELETE
USING (auth.uid() = user_id);

-- Políticas RLS para fila
CREATE POLICY "Users can view queue of their campaigns"
ON public.broadcast_queue FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can insert queue for their campaigns"
ON public.broadcast_queue FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update queue of their campaigns"
ON public.broadcast_queue FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

CREATE POLICY "Users can delete queue of their campaigns"
ON public.broadcast_queue FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.broadcast_campaigns
  WHERE id = broadcast_queue.campaign_id AND user_id = auth.uid()
));

-- Índices para performance
DROP INDEX IF EXISTS idx_broadcast_queue_campaign CASCADE;
CREATE INDEX idx_broadcast_queue_campaign ON
CREATE INDEX idx_broadcast_queue_campaign ON public.broadcast_queue(campaign_id);
DROP INDEX IF EXISTS idx_broadcast_queue_status CASCADE;
CREATE INDEX idx_broadcast_queue_status ON
CREATE INDEX idx_broadcast_queue_status ON public.broadcast_queue(status);
DROP INDEX IF EXISTS idx_broadcast_queue_scheduled CASCADE;
CREATE INDEX idx_broadcast_queue_scheduled ON
CREATE INDEX idx_broadcast_queue_scheduled ON public.broadcast_queue(scheduled_for) WHERE status = 'scheduled';