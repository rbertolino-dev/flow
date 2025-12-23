-- Tabela para armazenar configurações de custo do Lovable Cloud
CREATE TABLE IF NOT EXISTS public.cloud_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Custos por operação (em dólares)
  cost_per_database_read NUMERIC(10, 6) DEFAULT 0.000001,
  cost_per_database_write NUMERIC(10, 6) DEFAULT 0.000001,
  cost_per_storage_gb NUMERIC(10, 6) DEFAULT 0.021,
  cost_per_edge_function_call NUMERIC(10, 6) DEFAULT 0.0000002,
  cost_per_realtime_message NUMERIC(10, 6) DEFAULT 0.0000025,
  cost_per_auth_user NUMERIC(10, 6) DEFAULT 0.00325,
  
  -- Custos customizados para funções específicas
  cost_per_incoming_message NUMERIC(10, 6) DEFAULT 0.0001,
  cost_per_broadcast_message NUMERIC(10, 6) DEFAULT 0.0002,
  cost_per_scheduled_message NUMERIC(10, 6) DEFAULT 0.0001,
  cost_per_lead_storage NUMERIC(10, 6) DEFAULT 0.00001,
  
  -- Notas
  notes TEXT,
  
  -- Apenas uma linha de configuração por vez
  CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Inserir configuração padrão
INSERT INTO public.cloud_cost_config (id) 
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies
ALTER TABLE public.cloud_cost_config ENABLE ROW LEVEL SECURITY;

-- Super admins podem ver
CREATE POLICY "Super admins can view cloud cost config"
  ON public.cloud_cost_config
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  );

-- Super admins podem atualizar
CREATE POLICY "Super admins can update cloud cost config"
  ON public.cloud_cost_config
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_pubdigital_user(auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_cloud_cost_config_updated_at
  BEFORE UPDATE ON public.cloud_cost_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();