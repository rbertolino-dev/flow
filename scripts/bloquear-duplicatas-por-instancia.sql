-- ============================================================================
-- BLOQUEAR DUPLICATAS POR INSTÂNCIA (PENDING/SCHEDULED/SENDING)
-- ============================================================================
-- Objetivo: impedir repetição do mesmo número para a mesma instância/campanha
-- Aplica limpeza das duplicatas existentes e cria índice único parcial.
-- ============================================================================

-- 1) CANCELAR DUPLICATAS EXISTENTES (mantém a mais antiga)
WITH DuplicatesToCancel AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        phone,
        campaign_id,
        COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'::uuid),
        status
      ORDER BY created_at ASC
    ) AS rn
  FROM public.broadcast_queue
  WHERE status IN ('pending', 'scheduled', 'sending')
)
UPDATE public.broadcast_queue
SET
  status = 'cancelled',
  error_message = 'Duplicata cancelada automaticamente (mesmo telefone/instância/campanha).'
WHERE id IN (
  SELECT id FROM DuplicatesToCancel WHERE rn > 1
);

-- 2) CRIAR ÍNDICE ÚNICO PARA BLOQUEAR NOVAS DUPLICATAS ATIVAS
DROP INDEX IF EXISTS unique_bq_phone_campaign_instance_active_idx;

CREATE UNIQUE INDEX unique_bq_phone_campaign_instance_active_idx
ON public.broadcast_queue (
  phone,
  campaign_id,
  COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
WHERE status IN ('pending', 'scheduled', 'sending');

COMMENT ON INDEX unique_bq_phone_campaign_instance_active_idx IS
'Impede duplicatas ativas para o mesmo telefone + campanha + instância (pending/scheduled/sending).';

