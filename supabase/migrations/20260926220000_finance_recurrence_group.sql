ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_index INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_financial_entries_recurrence
  ON public.financial_entries (organization_id, recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

ALTER TABLE public.financial_entries DISABLE TRIGGER trg_log_financial_entry_change;

WITH parsed AS (
  SELECT
    id,
    organization_id,
    direction,
    COALESCE(lead_id::text, '') AS lead_key,
    date_trunc('hour', created_at) AS bucket,
    CASE
      WHEN description ~* '^PARC\. [0-9]+/[0-9]+:'
        THEN btrim((regexp_match(description, '^PARC\.\s*([0-9]+)\s*/\s*([0-9]+)\s*:\s*(.*)$'))[3])
      ELSE btrim((regexp_match(description, '^(.*) \(([0-9]+)/([0-9]+)\)$'))[1])
    END AS base_name,
    CASE
      WHEN description ~* '^PARC\. [0-9]+/[0-9]+:'
        THEN (regexp_match(description, '^PARC\.\s*([0-9]+)\s*/\s*([0-9]+)'))[1]::int
      ELSE (regexp_match(description, ' \(([0-9]+)/([0-9]+)\)$'))[1]::int
    END AS idx,
    CASE
      WHEN description ~* '^PARC\. [0-9]+/[0-9]+:'
        THEN (regexp_match(description, '^PARC\.\s*([0-9]+)\s*/\s*([0-9]+)'))[2]::int
      ELSE (regexp_match(description, ' \(([0-9]+)/([0-9]+)\)$'))[2]::int
    END AS total
  FROM public.financial_entries
  WHERE recurrence_group_id IS NULL
    AND description IS NOT NULL
    AND (
      description ~ ' \([0-9]+/[0-9]+\)$'
      OR description ~* '^PARC\. [0-9]+/[0-9]+:'
    )
),
grouped AS (
  SELECT
    id,
    idx,
    total,
    base_name,
    md5(
      organization_id::text || '|' || direction || '|' || lead_key || '|' ||
      bucket::text || '|' || base_name || '|' || total::text
    )::uuid AS group_id
  FROM parsed
  WHERE base_name IS NOT NULL AND idx IS NOT NULL AND total IS NOT NULL AND total > 1
)
UPDATE public.financial_entries AS entry
SET
  recurrence_group_id = grouped.group_id,
  recurrence_index = grouped.idx,
  recurrence_total = grouped.total,
  description = 'PARC. ' || grouped.idx || '/' || grouped.total || ': ' || grouped.base_name,
  is_recurring = true
FROM grouped
WHERE entry.id = grouped.id;

ALTER TABLE public.financial_entries ENABLE TRIGGER trg_log_financial_entry_change;
