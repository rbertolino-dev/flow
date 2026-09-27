import { supabase } from '@/integrations/supabase/client';
import { guessMimeTypeFromFilename, sanitizeAttachmentFilename } from '@/lib/leadAttachments';

export const FINANCE_ATTACHMENTS_BUCKET = 'finance-attachments';
export const MAX_FINANCE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function resolveFinanceAttachmentType(file: File): string {
  const fromFile = (file.type || '').trim();
  if (fromFile && fromFile !== 'application/octet-stream') return fromFile;
  return guessMimeTypeFromFilename(file.name) || 'application/octet-stream';
}

export async function uploadFinanceAttachment(
  organizationId: string,
  entryId: string,
  file: File
): Promise<{ path: string; name: string }> {
  if (file.size > MAX_FINANCE_ATTACHMENT_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 10 MB.');
  }
  const safeName = sanitizeAttachmentFilename(file.name);
  const path = `${organizationId}/${entryId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(FINANCE_ATTACHMENTS_BUCKET).upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: resolveFinanceAttachmentType(file),
  });
  if (error) throw new Error(error.message || 'Não foi possível enviar o anexo');
  return { path, name: file.name };
}

export async function downloadFinanceAttachment(storagePath: string, filename: string): Promise<void> {
  const { data, error } = await supabase.storage.from(FINANCE_ATTACHMENTS_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message || 'Não foi possível baixar o anexo');
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'anexo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
