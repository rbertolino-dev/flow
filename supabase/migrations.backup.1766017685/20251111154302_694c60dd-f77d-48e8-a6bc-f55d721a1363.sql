-- Tabela para armazenar métricas diárias de uso
CREATE TABLE IF NOT EXISTS public.daily_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  metric_type text NOT NULL, -- 'incoming_messages', 'broadcast_messages', 'scheduled_messages', 'database_reads', 'database_writes', 'edge_function_calls', 'storage_gb', 'auth_users', 'leads_stored'
  metric_value numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_date ON public.daily_usage_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_org ON public.daily_usage_metrics(organization_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_metrics_type ON public.daily_usage_metrics(metric_type, date DESC);

-- RLS Policies
ALTER TABLE public.daily_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all daily metrics"
  ON public.daily_usage_metrics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can insert daily metrics"
  ON public.daily_usage_metrics
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

CREATE POLICY "Super admins can update daily metrics"
  ON public.daily_usage_metrics
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_pubdigital_user(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_usage_metrics_updated_at
  BEFORE UPDATE ON public.daily_usage_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();