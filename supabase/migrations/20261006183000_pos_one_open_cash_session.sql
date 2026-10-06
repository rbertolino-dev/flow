-- Uma organização só pode ter um caixa do PDV aberto.
-- Sessões duplicadas mais antigas são fechadas antes do índice.

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id
           ORDER BY opened_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.pos_cash_sessions
  WHERE status = 'open'
)
UPDATE public.pos_cash_sessions
SET status = 'closed',
    closed_at = COALESCE(closed_at, now()),
    notes = CONCAT_WS(' ', NULLIF(notes, ''), 'Fechada automaticamente: havia outro caixa aberto.')
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS pos_cash_sessions_one_open_per_org
  ON public.pos_cash_sessions (organization_id)
  WHERE status = 'open';
