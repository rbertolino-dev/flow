-- PDFs de orçamento: limite de tamanho no Storage + Realtime com filtro (postgres_changes)

-- 1) Bucket dedicado a orçamentos: garantir existência e limite 50MB (evita "exceeded the maximum allowed size")
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'budget-pdfs',
  'budget-pdfs',
  true,
  52428800, -- 50 MiB
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  public = EXCLUDED.public;

-- 2) Bucket de mídia (PDFs de contrato ainda podem usar este bucket): alinhar limite
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'whatsapp-workflow-media'
  AND (file_size_limit IS NULL OR file_size_limit < 52428800);

-- 3) Realtime com filter organization_id=eq.… exige REPLICA IDENTITY FULL (evita "mismatch between server and client bindings")
ALTER TABLE public.budgets REPLICA IDENTITY FULL;
