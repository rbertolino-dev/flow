-- ============================================
-- Histórico de Campanhas Excluídas (Disparador 2)
-- ============================================
-- Armazena snapshot quando uma campanha é cancelada/excluída
-- Campos: nome, usuário que excluiu, horário, instância(s), leads vinculados
-- ============================================

CREATE TABLE IF NOT EXISTS public.broadcast_campaigns_deleted_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  deleted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by_email TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Instância(s) relacionada(s)
  instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL,
  instance_ids UUID[],
  
  -- Snapshot dos leads/contatos que estavam na fila (phone, name, instance_id)
  leads_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadados da campanha no momento da exclusão
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status_at_deletion TEXT,
  sending_method TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_deleted_history_org_id 
  ON public.broadcast_campaigns_deleted_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_deleted_history_deleted_at 
  ON public.broadcast_campaigns_deleted_history(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_deleted_history_deleted_by 
  ON public.broadcast_campaigns_deleted_history(deleted_by_user_id);

-- RLS
ALTER TABLE public.broadcast_campaigns_deleted_history ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas histórico da própria organização
CREATE POLICY "Users can view deleted history of their org"
ON public.broadcast_campaigns_deleted_history FOR SELECT
USING (
  public.user_belongs_to_org(auth.uid(), organization_id)
);

-- Apenas inserção via app (não permitir update/delete pelo usuário)
CREATE POLICY "Users can insert deleted history for their org"
ON public.broadcast_campaigns_deleted_history FOR INSERT
WITH CHECK (
  public.user_belongs_to_org(auth.uid(), organization_id)
  AND deleted_by_user_id = auth.uid()
);

COMMENT ON TABLE public.broadcast_campaigns_deleted_history IS 'Histórico de campanhas canceladas/excluídas do Disparador Inteligente';
