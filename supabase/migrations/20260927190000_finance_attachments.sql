ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS attachment_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance-attachments',
  'finance-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Finance attachments select" ON storage.objects;
CREATE POLICY "Finance attachments select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'finance-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance attachments insert" ON storage.objects;
CREATE POLICY "Finance attachments insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'finance-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance attachments update" ON storage.objects;
CREATE POLICY "Finance attachments update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'finance-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'finance-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Finance attachments delete" ON storage.objects;
CREATE POLICY "Finance attachments delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'finance-attachments'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.organization_members
    WHERE user_id = auth.uid()
  )
);
