-- Log de alterações em vendas do PDV (Hetzner / budget_services)
CREATE TABLE IF NOT EXISTS pos_sale_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  sale_id UUID NOT NULL,
  payment_id UUID,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_name TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_sale_logs_sale
  ON pos_sale_logs (organization_id, sale_id, created_at DESC);

COMMENT ON TABLE pos_sale_logs IS
  'Auditoria de mudanças na venda (ex.: forma de pagamento), com quem, quando e valor anterior';
