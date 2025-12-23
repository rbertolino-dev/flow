-- Add month_reference column to whatsapp_workflow_contact_attachments
ALTER TABLE whatsapp_workflow_contact_attachments 
ADD COLUMN IF NOT EXISTS month_reference text;