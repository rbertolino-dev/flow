-- Garantir que o bucket existe e é público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-workflow-media',
  'whatsapp-workflow-media',
  true,
  16777216, -- 16MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) 
DO UPDATE SET 
  public = true,
  file_size_limit = 16777216,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Allow authenticated users to upload status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to status media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their status media" ON storage.objects;

-- Política para permitir usuários autenticados fazerem upload
CREATE POLICY "Allow authenticated users to upload status media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-workflow-media');

-- Política para permitir acesso público a leitura (CRÍTICO para Evolution API)
CREATE POLICY "Allow public read access to status media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-workflow-media');

-- Política para permitir usuários autenticados deletarem seus próprios arquivos
CREATE POLICY "Allow authenticated users to delete their status media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-workflow-media');