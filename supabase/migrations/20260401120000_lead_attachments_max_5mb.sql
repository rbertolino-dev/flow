-- Aumenta limite de tamanho por anexo no lead (funil) de 2 MB para 5 MB

ALTER TABLE public.lead_attachments DROP CONSTRAINT IF EXISTS lead_attachments_size_cap;

ALTER TABLE public.lead_attachments
  ADD CONSTRAINT lead_attachments_size_cap CHECK (file_size > 0 AND file_size <= 5242880);

COMMENT ON TABLE public.lead_attachments IS 'Arquivos anexados ao lead (ate 5 MB). Bucket whatsapp-workflow-media em org/lead-attachments/lead_id/';
