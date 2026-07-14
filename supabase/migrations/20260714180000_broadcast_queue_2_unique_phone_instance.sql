-- Previne filas com o mesmo telefone + instância ativos na mesma campanha
-- (ex.: lista importada com WhatsApp repetido).
-- Modo "separate" continua válido: (campaign, phone, instance) distinto por chip.

DROP INDEX IF EXISTS idx_broadcast_queue_2_unique_campaign_phone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_queue_2_unique_campaign_phone_instance_active
  ON public.broadcast_queue_2 (campaign_id, phone, instance_id)
  WHERE status IN ('pending', 'scheduled', 'sending');

COMMENT ON INDEX idx_broadcast_queue_2_unique_campaign_phone_instance_active IS
  'Uma mensagem ativa por telefone+campanha+instância (pending/scheduled/sending)';
